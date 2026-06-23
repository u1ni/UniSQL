/**
 * aiService.js - AI integration service
 *
 * Supports two AI providers:
 *   1. OpenAI (api.openai.com) — requires API key
 *   2. Ollama (localhost:11434) — local, no API key needed
 *
 * Provides methods to explain queries, optimize queries, and chat
 * about database topics with schema context awareness.
 */

const fetch = require('node-fetch');
const { readJSON } = require('../utils/storage');

/**
 * Get the current AI configuration from storage.
 *
 * @returns {object} AI configuration { provider, model, apiKey, ollamaUrl }
 */
function getConfig() {
  return readJSON('ai-config.json');
}

/**
 * Build a system prompt that includes database schema context.
 *
 * @param {string} basePrompt - The core system instruction
 * @param {string} [schemaContext] - Optional schema context to include
 * @returns {string} Complete system prompt
 */
function buildSystemPrompt(basePrompt, schemaContext) {
  let prompt = basePrompt;

  if (schemaContext) {
    prompt += `\n\nHere is the database schema context for reference:\n${schemaContext}`;
  }

  return prompt;
}

/**
 * Send a request to the OpenAI Chat Completions API.
 *
 * @param {string} systemPrompt - System message content
 * @param {string} userMessage - User message content
 * @param {object} config - AI configuration
 * @returns {Promise<string>} The AI response text
 */
async function callOpenAI(systemPrompt, userMessage, config) {
  if (!config.apiKey) {
    throw new Error('OpenAI API key is not configured. Please set your API key in AI settings.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('OpenAI returned no response choices');
  }

  return data.choices[0].message.content;
}

/**
 * Send a request to the Ollama API (local LLM).
 *
 * @param {string} systemPrompt - System message content
 * @param {string} userMessage - User message content
 * @param {object} config - AI configuration
 * @returns {Promise<string>} The AI response text
 */
async function callOllama(systemPrompt, userMessage, config) {
  const ollamaUrl = config.ollamaUrl || 'http://127.0.0.1:11434';

  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'llama3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        options: {
          temperature: 0.3
        }
      })
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to Ollama at ${ollamaUrl}. ` +
      `Make sure Ollama is running (ollama serve). Error: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.message || !data.message.content) {
    throw new Error('Ollama returned an empty response');
  }

  return data.message.content;
}

/**
 * Send a request to the Anthropic (Claude) API.
 *
 * @param {string} systemPrompt - System message content
 * @param {string} userMessage - User message content
 * @param {object} config - AI configuration
 * @returns {Promise<string>} The AI response text
 */
async function callAnthropic(systemPrompt, userMessage, config) {
  if (!config.apiKey) {
    throw new Error('Anthropic API key is not configured. Please set your API key in AI settings.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.content || data.content.length === 0) {
    throw new Error('Anthropic returned an empty response');
  }

  return data.content[0].text;
}

/**
 * Send a request to the Google Gemini API.
 *
 * @param {string} systemPrompt - System message content
 * @param {string} userMessage - User message content
 * @param {object} config - AI configuration
 * @returns {Promise<string>} The AI response text
 */
async function callGemini(systemPrompt, userMessage, config) {
  if (!config.apiKey) {
    throw new Error('Gemini API key is not configured. Please set your API key in AI settings.');
  }

  const model = config.model || 'gemini-1.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned an empty response');
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Route an AI request to the configured provider.
 *
 * @param {string} systemPrompt - System message
 * @param {string} userMessage - User message
 * @returns {Promise<string>} AI response text
 */
async function sendToAI(systemPrompt, userMessage) {
  const config = getConfig();

  if (config.provider === 'openai') {
    return callOpenAI(systemPrompt, userMessage, config);
  } else if (config.provider === 'ollama') {
    return callOllama(systemPrompt, userMessage, config);
  } else if (config.provider === 'anthropic') {
    return callAnthropic(systemPrompt, userMessage, config);
  } else if (config.provider === 'gemini') {
    return callGemini(systemPrompt, userMessage, config);
  } else {
    throw new Error(`Unknown AI provider: ${config.provider}. Supported: openai, ollama, anthropic, gemini`);
  }
}

/**
 * Ask the AI to explain a SQL query in plain language.
 *
 * @param {string} sql - The SQL query to explain
 * @param {string} [schema] - Optional schema context
 * @returns {Promise<string>} Explanation text
 */
async function explainQuery(sql, schema) {
  const systemPrompt = buildSystemPrompt(
    `You are a senior SQL Server database expert. Your task is to explain SQL queries in clear, ` +
    `plain language. Break down the query into logical steps, explain what each part does, ` +
    `and describe the expected output. If you see potential issues or improvements, mention them briefly. ` +
    `Format your response with markdown for readability.`,
    schema
  );

  const userMessage = `Please explain this SQL query:\n\n\`\`\`sql\n${sql}\n\`\`\``;

  return sendToAI(systemPrompt, userMessage);
}

/**
 * Ask the AI to optimize a SQL query for better performance.
 *
 * @param {string} sql - The SQL query to optimize
 * @param {string} [schema] - Optional schema context
 * @returns {Promise<string>} Optimization suggestions and improved query
 */
async function optimizeQuery(sql, schema) {
  const systemPrompt = buildSystemPrompt(
    `You are a senior SQL Server performance tuning expert. Your task is to analyze SQL queries ` +
    `and suggest optimizations. Consider: index usage, query structure, JOINs, subqueries vs CTEs, ` +
    `proper use of WHERE clauses, avoiding SELECT *, parameter sniffing, and execution plan hints. ` +
    `Provide the optimized query and explain each change you made. ` +
    `Format your response with markdown and use SQL code blocks for queries.`,
    schema
  );

  const userMessage = `Please optimize this SQL query for better performance:\n\n\`\`\`sql\n${sql}\n\`\`\``;

  return sendToAI(systemPrompt, userMessage);
}

/**
 * General-purpose chat about databases, with schema context.
 *
 * @param {string} message - The user's chat message
 * @param {string} [context] - Optional context (schema, previous queries, etc.)
 * @returns {Promise<string>} AI response
 */
async function chat(message, context) {
  const systemPrompt = buildSystemPrompt(
    `You are a helpful SQL Server database assistant called UniSQL AI. You help users with: ` +
    `writing SQL queries, understanding database concepts, troubleshooting errors, ` +
    `database design, performance tuning, and general SQL Server administration. ` +
    `Always provide practical, actionable answers with code examples when relevant. ` +
    `Use SQL Server / T-SQL syntax specifically. Format your response with markdown.`,
    context
  );

  return sendToAI(systemPrompt, message);
}

module.exports = {
  explainQuery,
  optimizeQuery,
  chat,
  getConfig
};
