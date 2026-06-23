/**
 * storage.js - JSON file-based persistent storage utility
 *
 * Provides simple read/write operations for JSON data files stored
 * in the /data/ directory. Automatically initializes default files
 * if they are missing or corrupted.
 */

const fs = require('fs');
const path = require('path');

// Resolve the absolute path to the data directory
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Default content for each data file
const DEFAULTS = {
  'connections.json': [],
  'history.json': [],
  'ai-config.json': {
    provider: 'ollama',
    model: 'llama3',
    ollamaUrl: 'http://localhost:11434',
    apiKey: ''
  }
};

/**
 * Ensure the data directory and all default files exist.
 * Called once at startup to guarantee a valid data layer.
 */
function initializeDataFiles() {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[Storage] Created data directory:', DATA_DIR);
  }

  // Create each default file if missing
  for (const [filename, defaultContent] of Object.entries(DEFAULTS)) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
      console.log(`[Storage] Initialized default file: ${filename}`);
    }
  }
}

/**
 * Read and parse a JSON file from the data directory.
 *
 * @param {string} filename - Name of the file (e.g. 'connections.json')
 * @returns {any} Parsed JSON content, or the default value if file is missing/corrupted
 */
function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);

  try {
    if (!fs.existsSync(filePath)) {
      // Return default content if available, otherwise empty object
      const defaultContent = DEFAULTS[filename] !== undefined ? DEFAULTS[filename] : {};
      // Also write the default so it exists for next time
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
      return defaultContent;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Storage] Error reading ${filename}:`, err.message);
    // On parse error, return the default and reinitialize the file
    const defaultContent = DEFAULTS[filename] !== undefined ? DEFAULTS[filename] : {};
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error(`[Storage] Error reinitializing ${filename}:`, writeErr.message);
    }
    return defaultContent;
  }
}

/**
 * Write data to a JSON file in the data directory.
 *
 * @param {string} filename - Name of the file (e.g. 'connections.json')
 * @param {any} data - Data to serialize and write
 */
function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);

  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Storage] Error writing ${filename}:`, err.message);
    throw new Error(`Failed to save data to ${filename}: ${err.message}`);
  }
}

// Initialize data files on module load
initializeDataFiles();

module.exports = {
  readJSON,
  writeJSON,
  DATA_DIR
};
