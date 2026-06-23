/**
 * server.js - UniSQL Backend Entry Point
 *
 * Express application that serves as the backend for UniSQL,
 * a web-based SQL Server Management Studio alternative.
 *
 * Features:
 *   - Connection management (connect, disconnect, test, CRUD)
 *   - Database object exploration (tables, views, procedures, etc.)
 *   - SQL query execution with timing and safety checks
 *   - Query history persistence
 *   - AI-powered SQL assistance (OpenAI / Ollama)
 *   - MCP tool interface for AI agent integration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import route modules
const connectionsRouter = require('./src/routes/connections');
const databaseRouter = require('./src/routes/database');
const queryRouter = require('./src/routes/query');
const historyRouter = require('./src/routes/history');
const aiRouter = require('./src/routes/ai');
const { router: mcpRouter } = require('./src/mcp/mcpServer');

// Import services for graceful shutdown
const connectionManager = require('./src/services/connectionManager');

// ---------------------------------------------------------------------------
// App Configuration
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware Stack
// ---------------------------------------------------------------------------

// Security headers (relaxed for local development)
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP for API server
  crossOriginEmbedderPolicy: false
}));

// CORS — allow the frontend on localhost:3000
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-connection-id'],
  credentials: true
}));

// Request logging
app.use(morgan('dev'));

// JSON body parsing with a generous 50MB limit for large query results
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------------------------------------------------------------------
// Route Mounting
// ---------------------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UniSQL Backend',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/connections', connectionsRouter);
app.use('/api/databases', databaseRouter);
app.use('/api/query', queryRouter);
app.use('/api/history', historyRouter);
app.use('/api/ai', aiRouter);
app.use('/api/mcp', mcpRouter);

// ---------------------------------------------------------------------------
// 404 Handler - Catch unmatched routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Available endpoints: /api/health, /api/connections, /api/database, /api/query, /api/history, /api/ai, /api/mcp'
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err);

  // Don't leak stack traces in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// ---------------------------------------------------------------------------
// Server Startup
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║          UniSQL Backend Server           ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Status:    RUNNING                      ║`);
  console.log(`  ║  Port:      ${String(PORT).padEnd(29)}║`);
  console.log(`  ║  API:       http://localhost:${PORT}/api    ║`);
  console.log(`  ║  Health:    http://localhost:${PORT}/api/health ║`);
  console.log('  ║  CORS:      localhost:3000                ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Endpoints:');
  console.log('    /api/connections  - Connection management');
  console.log('    /api/database     - Database exploration');
  console.log('    /api/query        - Query execution');
  console.log('    /api/history      - Query history');
  console.log('    /api/ai           - AI assistance');
  console.log('    /api/mcp          - MCP tool interface');
  console.log('');
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  // Close all active database connections
  try {
    await connectionManager.disconnectAll();
    console.log('[Server] All database connections closed.');
  } catch (err) {
    console.error('[Server] Error closing connections:', err.message);
  }

  // Close the HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed. Goodbye!');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

module.exports = app;
