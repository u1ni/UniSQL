/**
 * query.js - Express Router for SQL query execution
 *
 * Handles executing user SQL queries against connected SQL Server instances.
 * Supports result measurement, dangerous query warnings, multiple result sets,
 * and export to CSV/JSON formats.
 */

const express = require('express');
const router = express.Router();
const connectionManager = require('../services/connectionManager');
const { detectDangerousQuery } = require('../utils/security');

/**
 * Middleware: Validate that x-connection-id header is present and valid.
 */
function requireConnection(req, res, next) {
  const connectionId = req.headers['x-connection-id'] || req.body?.connectionId;

  if (!connectionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing connection ID. Provide x-connection-id header or connectionId in body.'
    });
  }

  const pool = connectionManager.getPool(connectionId);
  if (!pool) {
    return res.status(404).json({
      success: false,
      error: 'Connection not found or expired. Please reconnect.'
    });
  }

  req.connectionId = connectionId;
  req.pool = pool;
  next();
}

router.use(requireConnection);

// ---------------------------------------------------------------------------
// POST /execute - Execute a SQL query
// ---------------------------------------------------------------------------
router.post('/execute', async (req, res) => {
  const { sql: sqlQuery, database } = req.body;

  if (!sqlQuery || typeof sqlQuery !== 'string' || sqlQuery.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'SQL query is required and must be a non-empty string.'
    });
  }

  // Check for dangerous queries (warn, don't block)
  const safety = detectDangerousQuery(sqlQuery);
  let dbPool = null;

  try {
    // Get the appropriate pool (database-specific if specified)
    if (database) {
      dbPool = await connectionManager.getPoolForDatabase(req.connectionId, database);
    } else {
      dbPool = req.pool;
    }

    // Collect informational messages from SQL Server
    const messages = [];
    const request = dbPool.request();

    // Listen for SQL Server messages (PRINT statements, info messages)
    request.on('info', (info) => {
      messages.push({
        message: info.message,
        number: info.number,
        state: info.state,
        class: info.class
      });
    });

    // Measure execution time
    const startTime = process.hrtime.bigint();
    const result = await request.query(sqlQuery);
    const endTime = process.hrtime.bigint();

    // Calculate execution time in milliseconds
    const executionTimeMs = Number(endTime - startTime) / 1_000_000;

    // Handle multiple result sets
    let resultSets = [];
    if (result.recordsets && result.recordsets.length > 0) {
      resultSets = result.recordsets.map((recordset, index) => {
        // Extract column metadata
        const columns = [];
        if (recordset.columns) {
          for (const [colName, colMeta] of Object.entries(recordset.columns)) {
            columns.push({
              name: colName,
              type: colMeta.type?.declaration || colMeta.type?.name || 'unknown',
              nullable: colMeta.nullable,
              length: colMeta.length
            });
          }
        }

        return {
          index,
          columns,
          rows: recordset,
          rowCount: recordset.length
        };
      });
    }

    // Primary result set (first one)
    const primaryResult = resultSets[0] || { columns: [], rows: [], rowCount: 0 };

    res.json({
      success: true,
      columns: primaryResult.columns,
      rows: primaryResult.rows,
      rowCount: result.rowsAffected?.reduce((a, b) => a + b, 0) || primaryResult.rowCount,
      executionTime: Math.round(executionTimeMs * 100) / 100,
      messages,
      warnings: safety.isDangerous ? safety.warnings : [],
      resultSets,
      rowsAffected: result.rowsAffected
    });
  } catch (err) {
    // SQL errors include useful metadata
    res.status(400).json({
      success: false,
      error: err.message,
      errorDetail: {
        number: err.number,
        state: err.state,
        class: err.class,
        lineNumber: err.lineNumber,
        procedure: err.procName
      },
      warnings: safety.isDangerous ? safety.warnings : []
    });
  } finally {
    // Close the temporary pool if it's not the main pool
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// POST /export - Execute a query and return results as CSV or JSON
// ---------------------------------------------------------------------------
router.post('/export', async (req, res) => {
  const { sql: sqlQuery, database, format = 'json' } = req.body;

  if (!sqlQuery || typeof sqlQuery !== 'string' || sqlQuery.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'SQL query is required.'
    });
  }

  if (!['csv', 'json'].includes(format)) {
    return res.status(400).json({
      success: false,
      error: 'Format must be "csv" or "json".'
    });
  }

  let dbPool = null;

  try {
    if (database) {
      dbPool = await connectionManager.getPoolForDatabase(req.connectionId, database);
    } else {
      dbPool = req.pool;
    }

    const result = await dbPool.request().query(sqlQuery);
    const rows = result.recordset || [];

    if (format === 'csv') {
      // Build CSV content
      if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
        return res.send('');
      }

      const columns = Object.keys(rows[0]);
      const csvLines = [];

      // Header row
      csvLines.push(columns.map(col => `"${col.replace(/"/g, '""')}"`).join(','));

      // Data rows
      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString();
          const str = String(val);
          // Escape double quotes and wrap in quotes if contains special chars
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvLines.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(csvLines.join('\r\n'));
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="export.json"');
      res.json({
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        rowCount: rows.length,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Export failed: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

module.exports = router;
