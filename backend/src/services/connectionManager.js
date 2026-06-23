/**
 * connectionManager.js - SQL Server connection pool manager
 *
 * Manages a Map of active mssql connection pools, keyed by connectionId.
 * Handles creating, testing, retrieving, and closing connections.
 */

const sql = require('mssql');
const { generateId } = require('../utils/security');

/**
 * Map of active connection pools.
 * Key: connectionId (string)
 * Value: { pool: sql.ConnectionPool, config: object, connectedAt: Date }
 */
const activePools = new Map();

/**
 * Build an mssql-compatible config object from our connection config.
 *
 * @param {object} config - Our connection configuration
 * @param {string} [database] - Optional database override
 * @returns {object} mssql connection config
 */
function buildMssqlConfig(config, database) {
  let server = config.server;
  let instanceName = undefined;

  if (server && server.includes('\\')) {
    const parts = server.split('\\');
    server = parts[0];
    instanceName = parts[1];
  }

  const mssqlConfig = {
    user: config.user,
    password: config.password,
    server: server,
    database: database || config.database || 'master',
    options: {
      encrypt: config.options?.encrypt || false,
      trustServerCertificate: config.options?.trustServerCertificate !== undefined
        ? config.options.trustServerCertificate
        : true,
      // Enable MARS for multiple active result sets
      enableArithAbort: true,
      instanceName: instanceName,
      // Fix for "Could not connect (sequence)" on older SQL servers with Node 18+
      cryptoCredentialsDetails: {
        minVersion: 'TLSv1'
      }
    },
    // Connection and request timeouts
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  // Tedious requires port to be omitted if using an instance name
  if (!instanceName) {
    mssqlConfig.port = parseInt(config.port, 10) || 1433;
  }

  return mssqlConfig;
}

/**
 * Create a new connection pool and store it in the active pools map.
 *
 * @param {object} config - Connection configuration
 * @returns {Promise<{ connectionId: string, serverInfo: object }>}
 */
async function connect(config) {
  const connectionId = generateId();
  const mssqlConfig = buildMssqlConfig(config);

  try {
    const pool = new sql.ConnectionPool(mssqlConfig);
    await pool.connect();

    // Fetch server version info
    const result = await pool.request().query(`
      SELECT 
        @@VERSION AS version,
        @@SERVERNAME AS serverName,
        SERVERPROPERTY('ProductVersion') AS productVersion,
        SERVERPROPERTY('ProductLevel') AS productLevel,
        SERVERPROPERTY('Edition') AS edition
    `);

    const serverInfo = result.recordset[0] || {};

    // Store the active pool
    activePools.set(connectionId, {
      pool,
      config: { ...config, password: undefined }, // Don't store password in memory map
      rawConfig: config, // Keep full config for database switching
      connectedAt: new Date().toISOString(),
      serverInfo
    });

    console.log(`[ConnectionManager] Connected: ${connectionId} -> ${config.server}:${config.port}`);

    return {
      connectionId,
      serverInfo: {
        serverName: serverInfo.serverName,
        productVersion: serverInfo.productVersion,
        productLevel: serverInfo.productLevel,
        edition: serverInfo.edition
      }
    };
  } catch (err) {
    console.error(`[ConnectionManager] Connection failed to ${config.server}:`, err.message);
    throw new Error(`Failed to connect to SQL Server: ${err.message}`);
  }
}

/**
 * Close and remove a connection pool.
 *
 * @param {string} connectionId - The connection ID to disconnect
 * @returns {Promise<boolean>} True if disconnected, false if not found
 */
async function disconnect(connectionId) {
  const entry = activePools.get(connectionId);
  if (!entry) {
    return false;
  }

  try {
    await entry.pool.close();
    console.log(`[ConnectionManager] Disconnected: ${connectionId}`);
  } catch (err) {
    console.warn(`[ConnectionManager] Error closing pool ${connectionId}:`, err.message);
  }

  activePools.delete(connectionId);
  return true;
}

/**
 * Get an active connection pool by ID.
 *
 * @param {string} connectionId - The connection ID
 * @returns {sql.ConnectionPool|null} The pool, or null if not found
 */
function getPool(connectionId) {
  const entry = activePools.get(connectionId);
  if (!entry) {
    return null;
  }
  return entry.pool;
}

/**
 * Get the stored raw config for a connection (used for database switching).
 *
 * @param {string} connectionId - The connection ID
 * @returns {object|null} The raw connection config
 */
function getConnectionConfig(connectionId) {
  const entry = activePools.get(connectionId);
  if (!entry) {
    return null;
  }
  return entry.rawConfig;
}

/**
 * Test a connection without storing it in the pool map.
 * Creates a temporary pool, fetches server info, then closes it.
 *
 * @param {object} config - Connection configuration to test
 * @returns {Promise<object>} Server version information
 */
async function testConnection(config) {
  const mssqlConfig = buildMssqlConfig(config);
  let pool = null;

  try {
    pool = new sql.ConnectionPool(mssqlConfig);
    await pool.connect();

    const result = await pool.request().query(`
      SELECT 
        @@VERSION AS version,
        @@SERVERNAME AS serverName,
        SERVERPROPERTY('ProductVersion') AS productVersion,
        SERVERPROPERTY('ProductLevel') AS productLevel,
        SERVERPROPERTY('Edition') AS edition,
        DB_NAME() AS currentDatabase
    `);

    const info = result.recordset[0] || {};

    return {
      success: true,
      serverName: info.serverName,
      productVersion: info.productVersion,
      productLevel: info.productLevel,
      edition: info.edition,
      currentDatabase: info.currentDatabase,
      version: info.version
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (e) {
        // Ignore close errors during test
      }
    }
  }
}

/**
 * Create a temporary pool connected to a specific database.
 * This is the safest way to switch databases — a fresh pool with
 * the target database set in the config.
 *
 * @param {string} connectionId - The active connection ID
 * @param {string} database - The target database name
 * @returns {Promise<sql.ConnectionPool>} A connected pool targeting the specified database
 */
async function getPoolForDatabase(connectionId, database) {
  const entry = activePools.get(connectionId);
  if (!entry) {
    throw new Error('Connection not found. Please connect first.');
  }

  // If the target database matches the current pool's database, reuse it
  if (!database || database === entry.rawConfig.database) {
    return entry.pool;
  }

  // Create a new pool for the target database
  const mssqlConfig = buildMssqlConfig(entry.rawConfig, database);
  const dbPool = new sql.ConnectionPool(mssqlConfig);
  await dbPool.connect();

  return dbPool;
}

/**
 * Get a list of all active connections (without sensitive data).
 *
 * @returns {Array<object>} Array of active connection summaries
 */
function listActiveConnections() {
  const connections = [];
  for (const [id, entry] of activePools.entries()) {
    connections.push({
      connectionId: id,
      server: entry.config.server,
      port: entry.config.port,
      database: entry.config.database,
      connectedAt: entry.connectedAt,
      isConnected: entry.pool.connected
    });
  }
  return connections;
}

/**
 * Close all active connections. Used during graceful shutdown.
 */
async function disconnectAll() {
  const ids = Array.from(activePools.keys());
  for (const id of ids) {
    await disconnect(id);
  }
  console.log(`[ConnectionManager] All connections closed (${ids.length} total)`);
}

module.exports = {
  connect,
  disconnect,
  getPool,
  getConnectionConfig,
  testConnection,
  getPoolForDatabase,
  listActiveConnections,
  disconnectAll,
  buildMssqlConfig
};
