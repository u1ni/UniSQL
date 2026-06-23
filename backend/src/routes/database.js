/**
 * database.js - Express Router for database object exploration
 *
 * Provides endpoints to browse the structure of a SQL Server instance:
 * databases, tables, views, procedures, functions, columns, indexes, keys.
 *
 * All endpoints require an active connectionId via x-connection-id header.
 * When a database name is specified, we create a temporary pool targeted
 * at that database rather than using USE statements (safer with pooling).
 */

const express = require('express');
const router = express.Router();
const connectionManager = require('../services/connectionManager');

/**
 * Middleware: Validate that x-connection-id header is present and valid.
 */
function requireConnection(req, res, next) {
  const connectionId = req.headers['x-connection-id'];

  if (!connectionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing x-connection-id header. Please connect to a server first.'
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

// Apply connection middleware to all routes in this router
router.use(requireConnection);

// ---------------------------------------------------------------------------
// GET /databases - List all databases on the server
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await req.pool.request().query(`
      SELECT 
        d.name,
        d.database_id AS databaseId,
        d.state_desc AS state,
        d.recovery_model_desc AS recoveryModel,
        d.compatibility_level AS compatibilityLevel,
        d.create_date AS createDate,
        CAST(SUM(mf.size) * 8.0 / 1024 AS DECIMAL(10,2)) AS sizeMB
      FROM sys.databases d
      LEFT JOIN sys.master_files mf ON d.database_id = mf.database_id
      GROUP BY d.name, d.database_id, d.state_desc, 
               d.recovery_model_desc, d.compatibility_level, d.create_date
      ORDER BY d.name
    `);

    res.json({
      success: true,
      databases: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list databases: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/tables - List all tables in a database
// ---------------------------------------------------------------------------
router.get('/:db/tables', async (req, res) => {
  const { db } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request().query(`
      SELECT 
        t.TABLE_SCHEMA AS [schema],
        t.TABLE_NAME AS name,
        t.TABLE_TYPE AS type,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c 
         WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME) AS columnCount,
        p.rows AS [rowCount]
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME 
        AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
      LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0, 1)
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `);

    res.json({
      success: true,
      database: db,
      tables: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list tables in ${db}: ${err.message}`
    });
  } finally {
    // Close the temporary pool if it's not the main pool
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/views - List all views in a database
// ---------------------------------------------------------------------------
router.get('/:db/views', async (req, res) => {
  const { db } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request().query(`
      SELECT 
        TABLE_SCHEMA AS [schema],
        TABLE_NAME AS name,
        IS_UPDATABLE AS isUpdatable
      FROM INFORMATION_SCHEMA.VIEWS
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    res.json({
      success: true,
      database: db,
      views: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list views in ${db}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/procedures - List all stored procedures
// ---------------------------------------------------------------------------
router.get('/:db/procedures', async (req, res) => {
  const { db } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request().query(`
      SELECT 
        SCHEMA_NAME(schema_id) AS [schema],
        name,
        create_date AS createDate,
        modify_date AS modifyDate,
        type_desc AS typeDescription
      FROM sys.procedures
      WHERE is_ms_shipped = 0
      ORDER BY SCHEMA_NAME(schema_id), name
    `);

    res.json({
      success: true,
      database: db,
      procedures: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list procedures in ${db}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/functions - List all user-defined functions
// ---------------------------------------------------------------------------
router.get('/:db/functions', async (req, res) => {
  const { db } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request().query(`
      SELECT 
        SCHEMA_NAME(schema_id) AS [schema],
        name,
        type AS typeCode,
        CASE type
          WHEN 'FN' THEN 'Scalar Function'
          WHEN 'IF' THEN 'Inline Table-Valued Function'
          WHEN 'TF' THEN 'Table-Valued Function'
          ELSE type_desc
        END AS typeDescription,
        create_date AS createDate,
        modify_date AS modifyDate
      FROM sys.objects
      WHERE type IN ('FN', 'IF', 'TF')
        AND is_ms_shipped = 0
      ORDER BY SCHEMA_NAME(schema_id), name
    `);

    res.json({
      success: true,
      database: db,
      functions: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list functions in ${db}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/tables/:schema/:table/columns - List columns with types
// ---------------------------------------------------------------------------
router.get('/:db/tables/:schema/:table/columns', async (req, res) => {
  const { db, schema, table } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request()
      .input('schema', schema)
      .input('table', table)
      .query(`
        SELECT 
          c.COLUMN_NAME AS name,
          c.DATA_TYPE AS dataType,
          c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
          c.NUMERIC_PRECISION AS numericPrecision,
          c.NUMERIC_SCALE AS numericScale,
          c.IS_NULLABLE AS isNullable,
          c.COLUMN_DEFAULT AS defaultValue,
          c.ORDINAL_POSITION AS ordinalPosition,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS isPrimaryKey,
          COLUMNPROPERTY(OBJECT_ID(@schema + '.' + @table), c.COLUMN_NAME, 'IsIdentity') AS isIdentity
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND ku.TABLE_SCHEMA = @schema
            AND ku.TABLE_NAME = @table
        ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
        ORDER BY c.ORDINAL_POSITION
      `);

    res.json({
      success: true,
      database: db,
      schema,
      table,
      columns: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list columns for ${schema}.${table}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/tables/:schema/:table/indexes - List indexes
// ---------------------------------------------------------------------------
router.get('/:db/tables/:schema/:table/indexes', async (req, res) => {
  const { db, schema, table } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request()
      .input('schema', schema)
      .input('table', table)
      .query(`
        SELECT 
          i.name AS indexName,
          i.type_desc AS indexType,
          i.is_unique AS isUnique,
          i.is_primary_key AS isPrimaryKey,
          STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns,
          i.fill_factor AS fillFactor,
          i.is_disabled AS isDisabled
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(@schema + '.' + @table)
          AND i.name IS NOT NULL
        GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key, i.fill_factor, i.is_disabled
        ORDER BY i.is_primary_key DESC, i.name
      `);

    res.json({
      success: true,
      database: db,
      schema,
      table,
      indexes: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list indexes for ${schema}.${table}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// GET /databases/:db/tables/:schema/:table/keys - List foreign keys
// ---------------------------------------------------------------------------
router.get('/:db/tables/:schema/:table/keys', async (req, res) => {
  const { db, schema, table } = req.params;
  let dbPool = null;

  try {
    dbPool = await connectionManager.getPoolForDatabase(req.connectionId, db);

    const result = await dbPool.request()
      .input('schema', schema)
      .input('table', table)
      .query(`
        SELECT 
          fk.name AS foreignKeyName,
          SCHEMA_NAME(fk.schema_id) AS [schema],
          tp.name AS parentTable,
          cp.name AS parentColumn,
          tr.name AS referencedTable,
          SCHEMA_NAME(tr.schema_id) AS referencedSchema,
          cr.name AS referencedColumn,
          fk.delete_referential_action_desc AS onDelete,
          fk.update_referential_action_desc AS onUpdate,
          fk.is_disabled AS isDisabled
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        WHERE tp.name = @table AND SCHEMA_NAME(tp.schema_id) = @schema
        ORDER BY fk.name
      `);

    res.json({
      success: true,
      database: db,
      schema,
      table,
      foreignKeys: result.recordset
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list foreign keys for ${schema}.${table}: ${err.message}`
    });
  } finally {
    if (dbPool && dbPool !== req.pool) {
      try { await dbPool.close(); } catch (e) { /* ignore */ }
    }
  }
});

module.exports = router;
