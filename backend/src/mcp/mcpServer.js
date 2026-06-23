/**
 * mcpServer.js - MCP (Model Context Protocol) tools definition
 *
 * Defines MCP-compatible tools that can be invoked by AI agents
 * to interact with SQL Server databases. Each tool has a name,
 * description, JSON Schema input definition, and an async handler.
 *
 * Also exports an Express router for HTTP-based tool discovery and execution.
 */

const express = require('express');
const router = express.Router();
const connectionManager = require('../services/connectionManager');

// ---------------------------------------------------------------------------
// MCP Tool Definitions
// ---------------------------------------------------------------------------

const mcpTools = [
  {
    name: 'get_tables',
    description: 'List all tables in a specified database, including schema, name, and row counts.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'The active connection ID'
        },
        database: {
          type: 'string',
          description: 'The database name to list tables from'
        }
      },
      required: ['connectionId', 'database']
    },
    handler: async ({ connectionId, database }) => {
      const dbPool = await connectionManager.getPoolForDatabase(connectionId, database);
      try {
        const result = await dbPool.request().query(`
          SELECT 
            t.TABLE_SCHEMA AS [schema],
            t.TABLE_NAME AS name,
            p.rows AS rowCount
          FROM INFORMATION_SCHEMA.TABLES t
          LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME 
            AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
          LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0, 1)
          WHERE t.TABLE_TYPE = 'BASE TABLE'
          ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
        `);
        return { tables: result.recordset };
      } finally {
        const mainPool = connectionManager.getPool(connectionId);
        if (dbPool && dbPool !== mainPool) {
          try { await dbPool.close(); } catch (e) { /* ignore */ }
        }
      }
    }
  },
  {
    name: 'get_schema',
    description: 'Get the full schema (columns, types, keys) for a specific table.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'The active connection ID'
        },
        database: {
          type: 'string',
          description: 'The database name'
        },
        schema: {
          type: 'string',
          description: 'The table schema (e.g., "dbo")',
          default: 'dbo'
        },
        table: {
          type: 'string',
          description: 'The table name'
        }
      },
      required: ['connectionId', 'database', 'table']
    },
    handler: async ({ connectionId, database, schema = 'dbo', table }) => {
      const dbPool = await connectionManager.getPoolForDatabase(connectionId, database);
      try {
        // Get columns
        const columnsResult = await dbPool.request()
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
              CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS isPrimaryKey
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

        // Get foreign keys
        const fkResult = await dbPool.request()
          .input('schema', schema)
          .input('table', table)
          .query(`
            SELECT 
              fk.name AS foreignKeyName,
              cp.name AS column_name,
              tr.name AS referencedTable,
              SCHEMA_NAME(tr.schema_id) AS referencedSchema,
              cr.name AS referencedColumn
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
            JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
            JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
            WHERE tp.name = @table AND SCHEMA_NAME(tp.schema_id) = @schema
          `);

        return {
          schema,
          table,
          columns: columnsResult.recordset,
          foreignKeys: fkResult.recordset
        };
      } finally {
        const mainPool = connectionManager.getPool(connectionId);
        if (dbPool && dbPool !== mainPool) {
          try { await dbPool.close(); } catch (e) { /* ignore */ }
        }
      }
    }
  },
  {
    name: 'run_query',
    description: 'Execute a SQL query against a connected SQL Server database and return the results.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'The active connection ID'
        },
        database: {
          type: 'string',
          description: 'The database to query against'
        },
        sql: {
          type: 'string',
          description: 'The SQL query to execute'
        }
      },
      required: ['connectionId', 'sql']
    },
    handler: async ({ connectionId, database, sql }) => {
      let dbPool;
      if (database) {
        dbPool = await connectionManager.getPoolForDatabase(connectionId, database);
      } else {
        dbPool = connectionManager.getPool(connectionId);
        if (!dbPool) throw new Error('Connection not found');
      }

      try {
        const startTime = process.hrtime.bigint();
        const result = await dbPool.request().query(sql);
        const endTime = process.hrtime.bigint();
        const executionTimeMs = Number(endTime - startTime) / 1_000_000;

        return {
          rows: result.recordset || [],
          rowCount: result.recordset?.length || 0,
          rowsAffected: result.rowsAffected,
          executionTime: Math.round(executionTimeMs * 100) / 100
        };
      } finally {
        const mainPool = connectionManager.getPool(connectionId);
        if (dbPool && dbPool !== mainPool) {
          try { await dbPool.close(); } catch (e) { /* ignore */ }
        }
      }
    }
  },
  {
    name: 'explain_query',
    description: 'Get the estimated execution plan for a SQL query to help understand performance.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'The active connection ID'
        },
        database: {
          type: 'string',
          description: 'The database context'
        },
        sql: {
          type: 'string',
          description: 'The SQL query to get the execution plan for'
        }
      },
      required: ['connectionId', 'sql']
    },
    handler: async ({ connectionId, database, sql }) => {
      let dbPool;
      if (database) {
        dbPool = await connectionManager.getPoolForDatabase(connectionId, database);
      } else {
        dbPool = connectionManager.getPool(connectionId);
        if (!dbPool) throw new Error('Connection not found');
      }

      try {
        // Enable showplan and get the estimated execution plan
        await dbPool.request().batch('SET SHOWPLAN_TEXT ON');

        const result = await dbPool.request().query(sql);

        await dbPool.request().batch('SET SHOWPLAN_TEXT OFF');

        return {
          plan: result.recordset || [],
          query: sql
        };
      } catch (err) {
        // Make sure we turn off showplan even if query fails
        try {
          await dbPool.request().batch('SET SHOWPLAN_TEXT OFF');
        } catch (e) { /* ignore */ }
        throw err;
      } finally {
        const mainPool = connectionManager.getPool(connectionId);
        if (dbPool && dbPool !== mainPool) {
          try { await dbPool.close(); } catch (e) { /* ignore */ }
        }
      }
    }
  }
];

// ---------------------------------------------------------------------------
// Tool execution handler
// ---------------------------------------------------------------------------

/**
 * Execute an MCP tool by name with the given arguments.
 *
 * @param {string} toolName - The tool name to execute
 * @param {object} args - The tool arguments
 * @returns {Promise<object>} Tool execution result
 */
async function executeTool(toolName, args) {
  const tool = mcpTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}. Available tools: ${mcpTools.map(t => t.name).join(', ')}`);
  }

  // Validate required arguments
  const required = tool.inputSchema.required || [];
  for (const param of required) {
    if (args[param] === undefined || args[param] === null) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }

  return tool.handler(args);
}

// ---------------------------------------------------------------------------
// HTTP Routes for MCP tool access
// ---------------------------------------------------------------------------

// POST /mcp/tools - List all available MCP tools
router.post('/tools', (req, res) => {
  try {
    const toolList = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    res.json({
      success: true,
      tools: toolList
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to list tools: ${err.message}`
    });
  }
});

// POST /mcp/execute - Execute an MCP tool
router.post('/execute', async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;

    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required.'
      });
    }

    const result = await executeTool(tool, args || {});

    res.json({
      success: true,
      tool,
      result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = {
  router,
  mcpTools,
  executeTool
};
