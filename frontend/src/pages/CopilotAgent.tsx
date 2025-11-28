import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
// Socket.IO removed for serverless compatibility - using polling instead
// import { io, Socket } from 'socket.io-client';
import { pollExecutionStatus } from '../lib/polling';
import { queryKeys } from '../lib/queryKeys';
import api from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    framework?: string;
    executionTime?: number;
    intermediateSteps?: Array<{
      action: { tool: string; toolInput: string };
      observation: string;
    }>;
  };
}

interface AgentExecution {
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Copilot Agent UI
 * 
 * Real-time chat interface for interacting with autonomous agents
 * Supports:
 * - Real-time chat with agents
 * - Agent execution streaming
 * - Flow editing integration
 * - Agent selection and configuration
 */
export default function CopilotAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('auto'); // 'auto' for automatic routing
  const [isConnected, setIsConnected] = useState(true); // Always connected with polling
  const [currentExecution, setCurrentExecution] = useState<AgentExecution | null>(null);                                                                        
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [suggestedWorkflow, setSuggestedWorkflow] = useState<any>(null);
  const pollingCancelRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Poll for execution status when currentExecution is set
  useEffect(() => {
    if (!currentExecution?.executionId) return;

    // Cancel any existing polling
    if (pollingCancelRef.current) {
      pollingCancelRef.current();
    }

    // Start polling for execution status
    const cancelPoll = pollExecutionStatus(currentExecution.executionId, {
      interval: 2000, // Poll every 2 seconds
      maxAttempts: 300, // Poll for up to 10 minutes (300 * 2s)
      onUpdate: (data: any) => {
        // Update execution status
        setCurrentExecution({
          executionId: data.id,
          status: data.status,
          output: data.result?.output || data.output,
          error: data.error,
          metadata: data.result?.metadata || data.metadata,
        });

        // Update last assistant message if status changed
        if (data.status === 'running' || data.status === 'completed' || data.status === 'failed') {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === currentExecution.executionId) {
              if (data.status === 'completed' && data.result?.output) {
                lastMessage.content = data.result.output;
              } else if (data.status === 'failed' && data.error) {
                lastMessage.content = `Error: ${data.error}`;
              }
              if (data.result?.metadata) {
                lastMessage.metadata = { ...lastMessage.metadata, ...data.result.metadata };
              }
              return newMessages;
            }
            return prev;
          });
        }
      },
      onComplete: (data: any) => {
        // Execution completed
        setCurrentExecution({
          executionId: data.id,
          status: data.status === 'completed' ? 'completed' : 'failed',
          output: data.result?.output || data.output,
          error: data.error,
          metadata: data.result?.metadata || data.metadata,
        });

        // Update last assistant message with final output
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === currentExecution.executionId) {
            if (data.status === 'completed' && data.result?.output) {
              lastMessage.content = data.result.output;
            } else if (data.status === 'failed' && data.error) {
              lastMessage.content = `Error: ${data.error}`;
            }
            if (data.result?.metadata) {
              lastMessage.metadata = { ...lastMessage.metadata, ...data.result.metadata };
            }
            return newMessages;
          }
          return newMessages;
        });
      },
      onError: (error: Error) => {
        console.error('Polling error:', error);
        setCurrentExecution((prev) => prev ? { ...prev, status: 'failed', error: error.message } : null);
      },
    });

    pollingCancelRef.current = cancelPoll;

    return () => {
      if (pollingCancelRef.current) {
        pollingCancelRef.current();
        pollingCancelRef.current = null;
      }
    };
  }, [currentExecution?.executionId]);

  // Fetch available agent frameworks
  const { data: frameworks } = useQuery({
    queryKey: queryKeys.agentFrameworks.all,
    queryFn: async () => {
      const response = await api.get('/agents/frameworks');
      return response.data;
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await api.post('/agents/execute', {
        query,
        agentType: selectedAgent === 'auto' ? undefined : selectedAgent,
        useRouting: selectedAgent === 'auto',
        stream: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Add user message
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: input,
        timestamp: new Date(),
      };

      // Set current execution to start polling
      if (data.executionId) {
        setCurrentExecution({
          executionId: data.executionId,
          status: 'running',
        });
      }

      // Add assistant message placeholder (will be updated via polling)
      const assistantMessage: Message = {
        id: data.executionId || `assistant_${Date.now()}`,
        role: 'assistant',
        content: 'Processing...',
        timestamp: new Date(),
        metadata: {
          agentId: data.agentId,
          framework: data.framework,
        },
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput('');
    },
    onError: (error: Error) => {
      // Add error message
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(input);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
          Agent Copilot
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Chat with autonomous agents in real-time</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Agent Configuration */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Agent Configuration</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Agent Framework
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
              >
                <option value="auto">Auto (Smart Routing)</option>
                {frameworks?.frameworks?.map((framework: any) => (
                  <option key={framework.name} value={framework.name}>
                    {framework.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selectedAgent === 'auto'
                  ? 'Automatically selects the best framework for your task'
                  : `Using ${frameworks?.frameworks?.find((f: any) => f.name === selectedAgent)?.displayName || selectedAgent}`}
              </p>
            </div>

            <div className="mb-4">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isConnected ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                {isConnected ? 'Connected (Polling)' : 'Disconnected'}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Using polling for real-time updates (serverless compatible)
              </p>
            </div>

            {currentExecution && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Current Execution</h4>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  currentExecution.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400' :
                  currentExecution.status === 'failed' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400' :
                  currentExecution.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}>
                  {currentExecution.status}
                </div>
                {currentExecution.metadata?.framework && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Framework: {currentExecution.metadata.framework as string}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agent Frameworks List */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Agent Frameworks</h3>
            {frameworks?.frameworks ? (
              <div className="space-y-3">
                {frameworks.frameworks.map((framework: any) => (
                  <div key={framework.name} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-b-0">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{framework.displayName}</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                        {framework.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{framework.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm h-[calc(100vh-12rem)] flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Agent Copilot</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Chat with autonomous agents</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
                  <p className="text-lg mb-2">Start a conversation with an agent</p>
                  <p className="text-sm">Ask questions, request tasks, or get help with workflows</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                          : message.role === 'system'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">
                          {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Agent'}
                        </span>
                        <span className="text-xs opacity-75 ml-2">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content || (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                            <span>Thinking...</span>
                          </div>
                        )}
                      </div>
                      {message.metadata && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.metadata.framework && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {message.metadata.framework}
                            </span>
                          )}
                          {message.metadata.executionTime && (
                            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                              {((message.metadata.executionTime as number) / 1000).toFixed(2)}s
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              {!isConnected && (
                <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">WebSocket disconnected. Reconnecting...</p>
                </div>
              )}

              {suggestedWorkflow && (
                <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Workflow Suggested</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">The agent has suggested a workflow for this task.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFlowEditor(true)}
                      className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded text-sm hover:from-indigo-700 hover:to-purple-700 transition-all"
                    >
                      Open in Flow Editor
                    </button>
                    <button
                      onClick={() => setSuggestedWorkflow(null)}
                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the agent..."
                  disabled={sendMessageMutation.isPending || !isConnected}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sendMessageMutation.isPending || !isConnected}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center transition-all"
                >
                  {sendMessageMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    'Send'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Flow Editor Modal */}
      {showFlowEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Workflow</h3>
              <button
                onClick={() => setShowFlowEditor(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {suggestedWorkflow ? (
                <div>
                  <p className="mb-2 text-gray-700 dark:text-gray-300">Workflow definition:</p>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-900 dark:text-gray-100">
                    {JSON.stringify(suggestedWorkflow, null, 2)}
                  </pre>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    Click "Open in Builder" to edit this workflow in the full workflow builder.
                  </p>
                </div>
              ) : (
                <p className="text-gray-700 dark:text-gray-300">No workflow to display</p>
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-2">
              <button
                onClick={() => setShowFlowEditor(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (suggestedWorkflow) {
                    navigate('/workflows/new', { state: { suggestedWorkflow } });
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Open in Builder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
