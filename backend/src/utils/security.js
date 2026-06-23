/**
 * security.js - Query safety and security utilities
 *
 * Provides functions to detect potentially dangerous SQL queries,
 * sanitize connection configurations, and generate unique IDs.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Patterns that indicate potentially dangerous SQL operations.
 * Each pattern has a regex, a human-readable label, and whether
 * it should only warn when there's no WHERE clause.
 */
const DANGEROUS_PATTERNS = [
  {
    pattern: /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION|SCHEMA|TRIGGER)\b/i,
    label: 'DROP statement detected',
    requiresNoWhere: false // DROP is always dangerous
  },
  {
    pattern: /\bDELETE\s+FROM\b/i,
    label: 'DELETE statement without WHERE clause',
    requiresNoWhere: true
  },
  {
    pattern: /\bTRUNCATE\s+TABLE\b/i,
    label: 'TRUNCATE TABLE statement detected',
    requiresNoWhere: false // TRUNCATE never has WHERE
  },
  {
    pattern: /\bUPDATE\b[\s\S]*?\bSET\b/i,
    label: 'UPDATE statement without WHERE clause',
    requiresNoWhere: true
  },
  {
    pattern: /\bALTER\s+(TABLE|DATABASE)\b/i,
    label: 'ALTER statement detected',
    requiresNoWhere: false
  },
  {
    pattern: /\bEXEC\s*\(/i,
    label: 'Dynamic SQL execution detected (EXEC)',
    requiresNoWhere: false
  },
  {
    pattern: /\bxp_cmdshell\b/i,
    label: 'xp_cmdshell detected - OS command execution',
    requiresNoWhere: false
  },
  {
    pattern: /\bSHUTDOWN\b/i,
    label: 'SHUTDOWN command detected',
    requiresNoWhere: false
  }
];

/**
 * Analyze a SQL query for potentially dangerous operations.
 * Returns warnings but does NOT block execution.
 *
 * @param {string} sql - The SQL query string to analyze
 * @returns {{ isDangerous: boolean, warnings: string[] }} Analysis result
 */
function detectDangerousQuery(sql) {
  if (!sql || typeof sql !== 'string') {
    return { isDangerous: false, warnings: [] };
  }

  const warnings = [];
  // Strip SQL comments to avoid false positives
  const cleanSql = sql
    .replace(/--.*$/gm, '')           // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .trim();

  const hasWhereClause = /\bWHERE\b/i.test(cleanSql);

  for (const { pattern, label, requiresNoWhere } of DANGEROUS_PATTERNS) {
    if (pattern.test(cleanSql)) {
      // Only warn if the pattern doesn't require a missing WHERE,
      // or if it does and there is indeed no WHERE clause
      if (!requiresNoWhere || !hasWhereClause) {
        warnings.push(label);
      }
    }
  }

  return {
    isDangerous: warnings.length > 0,
    warnings
  };
}

/**
 * Sanitize a connection config object for safe storage.
 * Trims strings, sets default values, and validates required fields.
 *
 * @param {object} config - Raw connection configuration
 * @returns {object} Sanitized configuration object
 */
function sanitizeConnectionConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid connection configuration');
  }

  const sanitized = {
    name: (config.name || 'Unnamed Connection').trim().substring(0, 100),
    server: (config.server || '').trim(),
    port: parseInt(config.port, 10) || 1433,
    database: (config.database || 'master').trim(),
    user: (config.user || '').trim(),
    password: config.password || '',
    options: {
      encrypt: config.options?.encrypt !== undefined ? Boolean(config.options.encrypt) : false,
      trustServerCertificate: config.options?.trustServerCertificate !== undefined
        ? Boolean(config.options.trustServerCertificate)
        : true
    }
  };

  // Validate required fields
  if (!sanitized.server) {
    throw new Error('Server address is required');
  }
  if (!sanitized.user) {
    throw new Error('Username is required');
  }

  return sanitized;
}

/**
 * Generate a unique identifier using UUID v4.
 *
 * @returns {string} A new UUID string
 */
function generateId() {
  return uuidv4();
}

/**
 * Mask a password string for safe display.
 * Shows only the first and last character if long enough.
 *
 * @param {string} password - The password to mask
 * @returns {string} Masked password string
 */
function maskPassword(password) {
  if (!password || password.length === 0) return '';
  if (password.length <= 2) return '**';
  return password[0] + '*'.repeat(password.length - 2) + password[password.length - 1];
}

module.exports = {
  detectDangerousQuery,
  sanitizeConnectionConfig,
  generateId,
  maskPassword
};
