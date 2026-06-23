/**
 * history.js - Express Router for query history management
 *
 * Persists executed queries with metadata (timing, database, server)
 * in history.json for recall and analysis.
 */

const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../utils/storage');
const { generateId } = require('../utils/security');

const HISTORY_FILE = 'history.json';

// Maximum number of history entries to keep
const MAX_HISTORY_SIZE = 500;

// ---------------------------------------------------------------------------
// GET / - Get query history (most recent first)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const history = readJSON(HISTORY_FILE);

    // Support optional query parameters for filtering
    let filtered = history;

    // Filter by database name
    if (req.query.database) {
      filtered = filtered.filter(h => h.database === req.query.database);
    }

    // Filter by server name
    if (req.query.server) {
      filtered = filtered.filter(h => h.server === req.query.server);
    }

    // Search in SQL text
    if (req.query.search) {
      const searchLower = req.query.search.toLowerCase();
      filtered = filtered.filter(h => h.sql && h.sql.toLowerCase().includes(searchLower));
    }

    // Limit results
    const limit = parseInt(req.query.limit, 10) || 100;
    filtered = filtered.slice(0, limit);

    res.json({
      success: true,
      history: filtered,
      totalCount: history.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to load history: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST / - Add a new entry to query history
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const { sql, database, server, executionTime, rowCount, error } = req.body;

    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'SQL query text is required.'
      });
    }

    const history = readJSON(HISTORY_FILE);

    const entry = {
      id: generateId(),
      sql: sql.trim(),
      database: database || null,
      server: server || null,
      executionTime: executionTime || null,
      rowCount: rowCount !== undefined ? rowCount : null,
      error: error || null,
      success: !error,
      timestamp: new Date().toISOString()
    };

    // Add to the beginning (most recent first)
    history.unshift(entry);

    // Trim history if it exceeds the maximum size
    if (history.length > MAX_HISTORY_SIZE) {
      history.splice(MAX_HISTORY_SIZE);
    }

    writeJSON(HISTORY_FILE, history);

    res.status(201).json({
      success: true,
      entry
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to save history: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE / - Clear all query history
// ---------------------------------------------------------------------------
router.delete('/', (req, res) => {
  try {
    writeJSON(HISTORY_FILE, []);

    res.json({
      success: true,
      message: 'Query history cleared.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to clear history: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id - Delete a specific history entry
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const history = readJSON(HISTORY_FILE);
    const index = history.findIndex(h => h.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found.'
      });
    }

    history.splice(index, 1);
    writeJSON(HISTORY_FILE, history);

    res.json({
      success: true,
      message: 'History entry deleted.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to delete history entry: ${err.message}`
    });
  }
});

module.exports = router;
