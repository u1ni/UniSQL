/**
 * connections.js - Express Router for connection management
 *
 * Handles CRUD operations for saved connections (persisted in connections.json)
 * and active connection lifecycle (connect, disconnect, test).
 */

const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../utils/storage');
const { sanitizeConnectionConfig, generateId, maskPassword } = require('../utils/security');
const connectionManager = require('../services/connectionManager');

const CONNECTIONS_FILE = 'connections.json';

// ---------------------------------------------------------------------------
// POST / - Save a new connection to persistent storage
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const config = sanitizeConnectionConfig(req.body);
    const connections = readJSON(CONNECTIONS_FILE);

    const newConnection = {
      id: generateId(),
      ...config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    connections.push(newConnection);
    writeJSON(CONNECTIONS_FILE, connections);

    // Return the saved connection with masked password
    res.status(201).json({
      success: true,
      connection: {
        ...newConnection,
        password: maskPassword(newConnection.password)
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------------------------------------------------------------------
// GET / - List all saved connections (passwords masked)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const connections = readJSON(CONNECTIONS_FILE);

    // Mask passwords before sending to the client
    const masked = connections.map(conn => ({
      ...conn,
      password: maskPassword(conn.password)
    }));

    res.json({
      success: true,
      connections: masked
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to load connections: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id - Update an existing saved connection
// ---------------------------------------------------------------------------
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const connections = readJSON(CONNECTIONS_FILE);
    const index = connections.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    const config = sanitizeConnectionConfig(req.body);

    // Preserve the original ID and creation date
    connections[index] = {
      ...connections[index],
      ...config,
      id,
      updatedAt: new Date().toISOString()
    };

    // If password is masked (unchanged), keep the old one
    if (req.body.password && req.body.password.includes('*')) {
      connections[index].password = readJSON(CONNECTIONS_FILE)[index].password;
    }

    writeJSON(CONNECTIONS_FILE, connections);

    res.json({
      success: true,
      connection: {
        ...connections[index],
        password: maskPassword(connections[index].password)
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id - Delete a saved connection
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const connections = readJSON(CONNECTIONS_FILE);
    const index = connections.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    connections.splice(index, 1);
    writeJSON(CONNECTIONS_FILE, connections);

    res.json({
      success: true,
      message: 'Connection deleted'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to delete connection: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST /test - Test a connection (does not persist)
// ---------------------------------------------------------------------------
router.post('/test', async (req, res) => {
  try {
    const config = sanitizeConnectionConfig(req.body);
    const result = await connectionManager.testConnection(config);

    if (result.success) {
      res.json({
        success: true,
        serverInfo: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /connect - Establish an active connection (returns connectionId)
// ---------------------------------------------------------------------------
router.post('/connect', async (req, res) => {
  try {
    let config;

    // Support connecting by saved connection ID or by raw config
    if (req.body.savedConnectionId) {
      const connections = readJSON(CONNECTIONS_FILE);
      const saved = connections.find(c => c.id === req.body.savedConnectionId);
      if (!saved) {
        return res.status(404).json({
          success: false,
          error: 'Saved connection not found'
        });
      }
      config = saved;
    } else {
      config = sanitizeConnectionConfig(req.body);
    }

    const result = await connectionManager.connect(config);

    res.json({
      success: true,
      connectionId: result.connectionId,
      serverInfo: result.serverInfo
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /disconnect - Close an active connection
// ---------------------------------------------------------------------------
router.post('/disconnect', async (req, res) => {
  try {
    const connectionId = req.body.connectionId || req.headers['x-connection-id'];

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: 'connectionId is required (body or x-connection-id header)'
      });
    }

    const wasDisconnected = await connectionManager.disconnect(connectionId);

    if (wasDisconnected) {
      res.json({
        success: true,
        message: 'Disconnected successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Connection not found or already disconnected'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to disconnect: ${err.message}`
    });
  }
});

module.exports = router;
