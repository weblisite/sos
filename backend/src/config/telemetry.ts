/**
 * OpenTelemetry Configuration
 * 
 * Configures OpenTelemetry for distributed tracing
 * Supports Signoz and other OTLP-compatible backends
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import dotenv from 'dotenv';

dotenv.config();

// Configuration from environment variables
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false'; // Default to enabled
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'sos-backend';
const OTEL_SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`;
const OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`;
const OTEL_ENVIRONMENT = process.env.NODE_ENV || 'development';
const OTEL_DEBUG = process.env.OTEL_DEBUG === 'true';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initializeTelemetry(): void {
  if (!OTEL_ENABLED) {
    console.log('⚠️ OpenTelemetry is disabled (OTEL_ENABLED=false)');
    return;
  }

  try {
    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: OTEL_SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: OTEL_SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
      'service.namespace': 'sos',
      'service.instance.id': process.env.HOSTNAME || 'unknown',
    });

    // Create trace exporter
    const traceExporter = OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ? new OTLPTraceExporter({
          url: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : {},
        })
      : new ConsoleSpanExporter();

    // Create metric exporter
    const metricExporter = OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      ? new OTLPMetricExporter({
          url: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : {},
        })
      : new ConsoleMetricExporter();

    // Create SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export every 60 seconds
      }),
      spanProcessor: new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          // Configure HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingRequestHook: (req) => {
              // Ignore health check endpoints
              const url = req.url || '';
              return url.includes('/health') || url.includes('/ping');
            },
          },
          // Configure Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.log('✅ OpenTelemetry initialized');
    console.log(`   Service: ${OTEL_SERVICE_NAME} v${OTEL_SERVICE_VERSION}`);
    console.log(`   Environment: ${OTEL_ENVIRONMENT}`);
    console.log(`   Traces endpoint: ${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}`);
    console.log(`   Metrics endpoint: ${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT}`);
  } catch (error: any) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    // Don't throw - telemetry should not break the application
  }
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('✅ OpenTelemetry shutdown complete');
    } catch (error: any) {
      console.error('❌ Error shutting down OpenTelemetry:', error);
    }
  }
}

/**
 * Get the current OpenTelemetry SDK instance
 */
export function getTelemetrySDK(): NodeSDK | null {
  return sdk;
}

// Export configuration for use in other modules
export const telemetryConfig = {
  enabled: OTEL_ENABLED,
  serviceName: OTEL_SERVICE_NAME,
  serviceVersion: OTEL_SERVICE_VERSION,
  tracesEndpoint: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  metricsEndpoint: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  environment: OTEL_ENVIRONMENT,
  debug: OTEL_DEBUG,
};

