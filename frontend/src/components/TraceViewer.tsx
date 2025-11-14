/**
 * Trace Viewer Component
 * 
 * Customer-facing component for viewing and analyzing traces
 * Displays trace information from Langfuse and OpenTelemetry
 */

import React, { useState, useEffect } from 'react';
import api from '../lib/api';

interface Trace {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'success' | 'error' | 'pending';
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
  cost?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  spans?: TraceSpan[];
}

interface TraceSpan {
  id: string;
  name: string;
  parentSpanId?: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'success' | 'error';
  attributes?: Record<string, any>;
  events?: Array<{
    name: string;
    time: string;
    attributes?: Record<string, any>;
  }>;
  cost?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

interface TraceViewerProps {
  traceId?: string;
  onTraceSelect?: (traceId: string) => void;
  workspaceId?: string;
  userId?: string;
  timeRange?: '1h' | '24h' | '7d' | '30d';
}

export const TraceViewer: React.FC<TraceViewerProps> = ({
  traceId,
  onTraceSelect,
  workspaceId,
  userId,
  timeRange: propTimeRange,
}) => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>(propTimeRange || '24h');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync timeRange with prop
  useEffect(() => {
    if (propTimeRange && propTimeRange !== timeRange) {
      setTimeRange(propTimeRange);
    }
  }, [propTimeRange]);

  // Load traces
  useEffect(() => {
    loadTraces();
  }, [timeRange, workspaceId, userId]);

  // Load specific trace if traceId is provided
  useEffect(() => {
    if (traceId) {
      loadTrace(traceId);
    }
  }, [traceId]);

  const loadTraces = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        range: timeRange,
        ...(workspaceId && { workspaceId }),
        ...(userId && { userId }),
      });
      const response = await api.get(`/api/v1/observability/traces?${params}`);
      setTraces(response.data.traces || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load traces');
      console.error('Error loading traces:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrace = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/v1/observability/traces/${id}`);
      setSelectedTrace(response.data);
      if (onTraceSelect) {
        onTraceSelect(id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load trace');
      console.error('Error loading trace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceClick = (trace: Trace) => {
    setSelectedTrace(trace);
    if (onTraceSelect) {
      onTraceSelect(trace.id);
    }
  };

  const filteredTraces = traces.filter((trace) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trace.name.toLowerCase().includes(query) ||
      trace.id.toLowerCase().includes(query) ||
      (trace.metadata?.framework && trace.metadata.framework.toLowerCase().includes(query))
    );
  });

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return 'N/A';
    return `$${cost.toFixed(4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const exportTraceAsJSON = async (trace: Trace) => {
    try {
      const response = await api.get(`/observability/traces/${trace.id}/export`, {
        responseType: 'blob',
      });
      
      // Convert blob to text and parse JSON
      const text = await response.data.text();
      const jsonData = JSON.parse(text);
      
      // Create blob with formatted JSON
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trace-${trace.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to export trace');
      console.error('Error exporting trace:', err);
    }
  };

  return (
    <div className="trace-viewer">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Trace Viewer</h4>
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            style={{ width: 'auto' }}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadTraces}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        {/* Trace List */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="card-body p-0" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {loading && traces.length === 0 ? (
                <div className="text-center p-3">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : filteredTraces.length === 0 ? (
                <div className="text-center p-3 text-muted">No traces found</div>
              ) : (
                <div className="list-group list-group-flush">
                  {filteredTraces.map((trace) => (
                    <button
                      key={trace.id}
                      type="button"
                      className={`list-group-item list-group-item-action ${
                        selectedTrace?.id === trace.id ? 'active' : ''
                      }`}
                      onClick={() => handleTraceClick(trace)}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <h6 className="mb-1">{trace.name}</h6>
                          <small className="text-muted">
                            {formatDate(trace.startTime)}
                          </small>
                        </div>
                        <span
                          className={`badge ${
                            trace.status === 'success'
                              ? 'bg-success'
                              : trace.status === 'error'
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                        >
                          {trace.status}
                        </span>
                      </div>
                      {trace.duration && (
                        <div className="mt-1">
                          <small className="text-muted">
                            Duration: {formatDuration(trace.duration)}
                          </small>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trace Details */}
        <div className="col-md-8">
          {selectedTrace ? (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Trace Details</h5>
                <div className="d-flex gap-2 align-items-center">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => exportTraceAsJSON(selectedTrace)}
                    title="Export trace as JSON"
                  >
                    <i className="bi bi-download me-1"></i>
                    Export JSON
                  </button>
                  <span
                    className={`badge ${
                      selectedTrace.status === 'success'
                        ? 'bg-success'
                        : selectedTrace.status === 'error'
                        ? 'bg-danger'
                        : 'bg-secondary'
                    }`}
                  >
                    {selectedTrace.status}
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Trace ID:</strong>
                    <br />
                    <code className="small">{selectedTrace.id}</code>
                  </div>
                  <div className="col-md-6">
                    <strong>Name:</strong>
                    <br />
                    {selectedTrace.name}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Start Time:</strong>
                    <br />
                    {formatDate(selectedTrace.startTime)}
                  </div>
                  {selectedTrace.endTime && (
                    <div className="col-md-6">
                      <strong>End Time:</strong>
                      <br />
                      {formatDate(selectedTrace.endTime)}
                    </div>
                  )}
                </div>

                {selectedTrace.duration && (
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <strong>Duration:</strong>
                      <br />
                      {formatDuration(selectedTrace.duration)}
                    </div>
                    {selectedTrace.cost && (
                      <div className="col-md-6">
                        <strong>Cost:</strong>
                        <br />
                        {formatCost(selectedTrace.cost)}
                      </div>
                    )}
                  </div>
                )}

                {selectedTrace.tokens && (
                  <div className="row mb-3">
                    <div className="col-md-4">
                      <strong>Prompt Tokens:</strong>
                      <br />
                      {selectedTrace.tokens.prompt?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="col-md-4">
                      <strong>Completion Tokens:</strong>
                      <br />
                      {selectedTrace.tokens.completion?.toLocaleString() || 'N/A'}
                    </div>
                    <div className="col-md-4">
                      <strong>Total Tokens:</strong>
                      <br />
                      {selectedTrace.tokens.total?.toLocaleString() || 'N/A'}
                    </div>
                  </div>
                )}

                {selectedTrace.metadata && Object.keys(selectedTrace.metadata).length > 0 && (
                  <div className="mb-3">
                    <strong>Metadata:</strong>
                    <pre className="bg-light p-2 rounded" style={{ fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedTrace.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedTrace.input && (
                  <div className="mb-3">
                    <strong>Input:</strong>
                    <pre className="bg-light p-2 rounded" style={{ fontSize: '0.875rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {typeof selectedTrace.input === 'string'
                        ? selectedTrace.input
                        : JSON.stringify(selectedTrace.input, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedTrace.output && (
                  <div className="mb-3">
                    <strong>Output:</strong>
                    <pre className="bg-light p-2 rounded" style={{ fontSize: '0.875rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {typeof selectedTrace.output === 'string'
                        ? selectedTrace.output
                        : JSON.stringify(selectedTrace.output, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedTrace.spans && selectedTrace.spans.length > 0 && (
                  <div className="mt-4">
                    <strong>Spans:</strong>
                    <div className="mt-2">
                      {selectedTrace.spans.map((span) => (
                        <div key={span.id} className="card mb-2">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <h6 className="mb-1">{span.name}</h6>
                                <small className="text-muted">
                                  {formatDate(span.startTime)} - {formatDate(span.endTime)}
                                </small>
                              </div>
                              <span
                                className={`badge ${
                                  span.status === 'success' ? 'bg-success' : 'bg-danger'
                                }`}
                              >
                                {span.status}
                              </span>
                            </div>
                            <div className="mt-2">
                              <small>
                                Duration: {formatDuration(span.duration)}
                                {span.cost && ` | Cost: ${formatCost(span.cost)}`}
                                {span.tokens?.total && ` | Tokens: ${span.tokens.total.toLocaleString()}`}
                              </small>
                            </div>
                            {span.attributes && Object.keys(span.attributes).length > 0 && (
                              <details className="mt-2">
                                <summary className="small">Attributes</summary>
                                <pre className="bg-light p-2 rounded mt-2" style={{ fontSize: '0.75rem' }}>
                                  {JSON.stringify(span.attributes, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center text-muted">
                Select a trace to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraceViewer;

