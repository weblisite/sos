// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Initialize OpenTelemetry FIRST before any other imports
import { initializeTelemetry, shutdownTelemetry } from './config/telemetry';
initializeTelemetry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import workflowsRouter from './routes/workflows';
import authRouter from './routes/auth';
import executionsRouter from './routes/executions';
import webhooksRouter from './routes/webhooks';
import statsRouter from './routes/stats';
import templatesRouter from './routes/templates';
import analyticsRouter from './routes/analytics';
import alertsRouter from './routes/alerts';
import rolesRouter from './routes/roles';
import teamsRouter from './routes/teams';
import invitationsRouter from './routes/invitations';
import usersRouter from './routes/users';
import apiKeysRouter from './routes/apiKeys';
import auditLogsRouter from './routes/auditLogs';
import emailOAuthRouter from './routes/emailOAuth';
import emailTriggerMonitoringRouter from './routes/emailTriggerMonitoring';
import performanceMonitoringRouter from './routes/performanceMonitoring';
import agentsRouter from './routes/agents';
import observabilityRouter from './routes/observability';
import osintRouter from './routes/osint';
import connectorsRouter from './routes/connectors';
import nangoRouter from './routes/nango';
import earlyAccessRouter from './routes/earlyAccess';
import contactRouter from './routes/contact';
import codeAgentsRouter from './routes/codeAgents';
import codeExecLogsRouter from './routes/codeExecLogs';
import policiesRouter from './routes/policies';
import { scheduler } from './services/scheduler';
import { permissionService } from './services/permissionService';
import { websocketService } from './services/websocketService';
import { emailTriggerService } from './services/emailTriggerService';
import { osintService } from './services/osintService';
import { auditLogMiddleware } from './middleware/auditLog';
import { performanceMiddleware } from './services/performanceMonitoring';
import { initializeAgentFrameworks } from './services/agentFrameworkInit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import redis from './config/redis';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Initialize WebSocket service
websocketService.initialize(io);

const PORT = Number(process.env.PORT) || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware (track all requests)
app.use(performanceMiddleware);

// Audit logging middleware (applied to all routes after authentication)
// Note: This will be applied per-route where authentication is required

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SynthralOS Automation Platform API Documentation',
}));

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/workflows', workflowsRouter);
app.use('/api/v1/executions', executionsRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/roles', rolesRouter);
app.use('/api/v1/teams', teamsRouter);
app.use('/api/v1/invitations', invitationsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/api-keys', apiKeysRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/api/v1/email-oauth', emailOAuthRouter);
app.use('/api/v1/email-triggers/monitoring', emailTriggerMonitoringRouter);
app.use('/api/v1/monitoring/performance', performanceMonitoringRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/observability', observabilityRouter);
app.use('/api/v1/osint', osintRouter);
app.use('/api/v1/connectors', connectorsRouter);
app.use('/api/v1/nango', nangoRouter);
app.use('/api/v1/early-access', earlyAccessRouter);
app.use('/api/v1/contact', contactRouter);
app.use('/api/v1/code-agents', codeAgentsRouter);
app.use('/api/v1/code-exec-logs', codeExecLogsRouter);
app.use('/api/v1/policies', policiesRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/webhooks', webhooksRouter);

app.get('/api/v1', (req, res) => {
  res.json({ message: 'SynthralOS Automation Platform API v1' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join execution room
  socket.on('execution:subscribe', (executionId: string) => {
    socket.join(`execution:${executionId}`);
    console.log(`Client ${socket.id} subscribed to execution ${executionId}`);
  });

  // Leave execution room
  socket.on('execution:unsubscribe', (executionId: string) => {
    socket.leave(`execution:${executionId}`);
    console.log(`Client ${socket.id} unsubscribed from execution ${executionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Serve static files from frontend dist directory (in production)
// This must be after all API routes but before the 404 handler
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../public');
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    // Skip API routes and other specific routes - these should have been handled above
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/api-docs')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // 404 handler for development (when frontend is served separately)
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, async () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize default permissions
  try {
    await permissionService.initializeDefaultPermissions();
    console.log('✅ Default permissions initialized');
  } catch (error) {
    console.error('⚠️  Error initializing permissions:', error);
  }
  
  // Start scheduler for scheduled workflows
  await scheduler.start();
  console.log('⏰ Scheduler started');
  
  // Initialize agent frameworks
  initializeAgentFrameworks();
  
  // Initialize self-healing service (repair queue is auto-initialized)
  console.log('✅ Self-healing service initialized');
  
  // Observability and analytics services are auto-initialized
  console.log('✅ Observability services initialized');
  
  // Start email trigger polling service
  try {
    await emailTriggerService.startPolling();
    console.log('📧 Email trigger service started');
    
    // Start OSINT monitoring service
    try {
      await osintService.startPolling();
      console.log('🔍 OSINT monitoring service started');
    } catch (error) {
      console.error('⚠️  Error starting OSINT service:', error);
    }
  } catch (error) {
    console.error('⚠️  Error starting email trigger service:', error);
  }

  // Test Redis connection
  try {
    await redis.ping();
    console.log('✅ Redis cache connected');
  } catch (error) {
    console.error('⚠️  Redis not available, caching disabled:', error);
  }

  // Initialize Supabase Storage bucket for code agents
  try {
    const { storageService } = await import('./services/storageService');
    await storageService.initializeBucket();
  } catch (error) {
    console.warn('⚠️  Supabase Storage initialization skipped:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownTelemetry();
  const { posthogService } = await import('./services/posthogService');
  const { rudderstackService } = await import('./services/rudderstackService');
  const { scraperService } = await import('./services/scraperService');
  await posthogService.flush();
  await rudderstackService.shutdown();
  await scraperService.cleanup(); // Cleanup browser pool
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownTelemetry();
  const { posthogService } = await import('./services/posthogService');
  const { rudderstackService } = await import('./services/rudderstackService');
  const { scraperService } = await import('./services/scraperService');
  await posthogService.flush();
  await rudderstackService.shutdown();
  await scraperService.cleanup(); // Cleanup browser pool
  process.exit(0);
});

export { app, io };

