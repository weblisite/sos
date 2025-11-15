import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import api from '../lib/api';
import TraceViewer from '../components/TraceViewer';

interface AgentExecutionMetrics {
  framework: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
}

interface SystemMetrics {
  totalExecutions: number;
  totalErrors: number;
  averageExecutionTime: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
  frameworks: AgentExecutionMetrics[];
}

/**
 * Observability Dashboard
 * 
 * Displays metrics and analytics for agent executions
 * Shows:
 * - System-wide metrics
 * - Framework-specific metrics
 * - Error rates and trends
 * - Cost and token usage
 */
export default function ObservabilityDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [activeTab, setActiveTab] = useState<'metrics' | 'traces'>('metrics');

  // Fetch system metrics
  const { data: systemMetrics, isLoading } = useQuery<SystemMetrics>({
    queryKey: queryKeys.observability.system(timeRange),
    queryFn: async () => {
      const response = await api.get(`/observability/metrics?range=${timeRange}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch error logs
  const { data: errorLogs } = useQuery({
    queryKey: queryKeys.observability.errors(timeRange),
    queryFn: async () => {
      const response = await api.get(`/observability/errors?range=${timeRange}`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Fetch code execution metrics
  const { data: codeMetrics } = useQuery({
    queryKey: ['code-execution-metrics', timeRange],
    queryFn: async () => {
      const response = await api.get(`/code-agents/analytics?timeRange=${timeRange === '1h' ? '7d' : timeRange}`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">Observability Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor agent executions, performance, and errors</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'metrics'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Metrics
          </button>
          <button
            onClick={() => setActiveTab('traces')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'traces'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Traces
          </button>
        </nav>
      </div>

      {/* Trace Viewer Tab */}
      {activeTab === 'traces' && (
        <div className="mb-6">
          <TraceViewer timeRange={timeRange} />
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <>

      {/* System Metrics */}
      {systemMetrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Executions</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{systemMetrics.totalExecutions.toLocaleString()}</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Success Rate</h3>
              <p className="text-3xl font-bold">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  systemMetrics.successRate >= 95 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400' :
                  systemMetrics.successRate >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400' :
                  'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400'
                }`}>
                  {systemMetrics.successRate.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-blue-300/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Avg Execution Time</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{(systemMetrics.averageExecutionTime / 1000).toFixed(2)}s</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Cost</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">${systemMetrics.totalCost.toFixed(4)}</p>
            </div>
          </div>

          {/* Framework Metrics */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Framework Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Framework</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Executions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {systemMetrics.frameworks.map((framework) => (
                    <tr key={framework.framework} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 rounded text-sm font-medium">
                          {framework.framework}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {framework.totalExecutions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          framework.successRate >= 95 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400' :
                          framework.successRate >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400' :
                          'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400'
                        }`}>
                          {framework.successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {(framework.averageExecutionTime / 1000).toFixed(2)}s
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {framework.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${framework.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Code Execution Metrics */}
      {codeMetrics?.stats && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Code Execution Metrics</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Executions</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {codeMetrics.stats.totalExecutions?.toLocaleString() || 0}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {((codeMetrics.stats.successRate || 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Duration</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {codeMetrics.stats.avgDurationMs > 0
                    ? `${(codeMetrics.stats.avgDurationMs / 1000).toFixed(2)}s`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {codeMetrics.stats.totalTokensUsed > 0
                    ? codeMetrics.stats.totalTokensUsed.toLocaleString()
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Runtime Breakdown */}
            {codeMetrics.stats.executionsByRuntime && Object.keys(codeMetrics.stats.executionsByRuntime).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Executions by Runtime</h4>
                <div className="space-y-2">
                  {Object.entries(codeMetrics.stats.executionsByRuntime).map(([runtime, count]: [string, any]) => {
                    const percentage = codeMetrics.stats.totalExecutions > 0
                      ? ((count / codeMetrics.stats.totalExecutions) * 100).toFixed(1)
                      : 0;
                    return (
                      <div key={runtime}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300">{runtime}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Language Breakdown */}
            {codeMetrics.stats.executionsByLanguage && Object.keys(codeMetrics.stats.executionsByLanguage).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Executions by Language</h4>
                <div className="space-y-2">
                  {Object.entries(codeMetrics.stats.executionsByLanguage).map(([language, count]: [string, any]) => {
                    const percentage = codeMetrics.stats.totalExecutions > 0
                      ? ((count / codeMetrics.stats.totalExecutions) * 100).toFixed(1)
                      : 0;
                    return (
                      <div key={language}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">{language}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Logs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Errors</h3>
        </div>
        <div className="p-4">
          {errorLogs?.errors && errorLogs.errors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Framework</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Error Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {errorLogs.errors.slice(0, 20).map((error: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(error.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs">
                          {error.framework || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400 rounded text-xs">
                          {error.errorType || 'error'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <span className="text-xs">{error.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No errors in the selected time range</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
