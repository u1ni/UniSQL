/**
 * ai.js - Express Router for AI-assisted features
 *
 * Provides endpoints for AI configuration management and AI-powered
 * SQL assistance (explain, optimize, chat).
 */

const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../utils/storage');
const aiService = require('../services/aiService');

const AI_CONFIG_FILE = 'ai-config.json';

// ---------------------------------------------------------------------------
// GET /config - Get current AI configuration
// ---------------------------------------------------------------------------
router.get('/config', (req, res) => {
  try {
    const config = readJSON(AI_CONFIG_FILE);

    // Mask the API key for security
    const masked = {
      ...config,
      apiKey: config.apiKey ? config.apiKey.substring(0, 8) + '...' : ''
    };

    res.json({
      success: true,
      config: masked
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to load AI config: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// GET /models - Fetch available models from Ollama
// ---------------------------------------------------------------------------
router.get('/models', async (req, res) => {
  try {
    const config = readJSON(AI_CONFIG_FILE);
    const ollamaUrl = config.ollamaUrl || 'http://127.0.0.1:11434';
    
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      models: data.models ? data.models.map(m => m.name) : []
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch Ollama models: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// PUT /config - Save AI configuration
// ---------------------------------------------------------------------------
router.put('/config', (req, res) => {
  try {
    const { provider, apiKey, model, ollamaUrl } = req.body;

    // Validate provider
    const validProviders = ['openai', 'ollama', 'anthropic', 'gemini'];
    if (provider && !validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
      });
    }

    // Read existing config and merge updates
    const existing = readJSON(AI_CONFIG_FILE);
    const updated = {
      provider: provider || existing.provider || 'ollama',
      model: model || existing.model || 'llama3',
      ollamaUrl: ollamaUrl || existing.ollamaUrl || 'http://127.0.0.1:11434',
      apiKey: apiKey !== undefined ? apiKey : existing.apiKey || ''
    };

    writeJSON(AI_CONFIG_FILE, updated);

    res.json({
      success: true,
      config: {
        ...updated,
        apiKey: updated.apiKey ? updated.apiKey.substring(0, 8) + '...' : ''
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to save AI config: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST /explain - Explain a SQL query using AI
// ---------------------------------------------------------------------------
router.post('/explain', async (req, res) => {
  try {
    const { sql, schema } = req.body;

    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required.'
      });
    }

    const explanation = await aiService.explainQuery(sql, schema || '');

    res.json({
      success: true,
      explanation
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI explanation failed: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST /optimize - Optimize a SQL query using AI
// ---------------------------------------------------------------------------
router.post('/optimize', async (req, res) => {
  try {
    const { sql, schema } = req.body;

    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required.'
      });
    }

    const optimization = await aiService.optimizeQuery(sql, schema || '');

    res.json({
      success: true,
      optimization
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI optimization failed: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST /chat - Chat with AI about database topics
// ---------------------------------------------------------------------------
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required.'
      });
    }

    const reply = await aiService.chat(message, context || '');

    res.json({
      success: true,
      reply
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI chat failed: ${err.message}`
    });
  }
});

module.exports = router;
