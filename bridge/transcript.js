'use strict';
/**
 * transcript.js — read a Claude Code session .jsonl file and return a structured message list.
 * CommonJS, zero external dependencies (fs, path, os, readline).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const SESSION_ID_RE = /^[\w-]+$/;
const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const MAX_MESSAGES = 500;
const TEXT_CAP = 4000;
const TOOL_INPUT_CAP = 300;

/** Safely stringify a value and cap it. */
function capStr(v, cap) {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > cap ? s.slice(0, cap) + '…' : s;
}

/**
 * Flatten a message content value (string or block array) into { text, tools }.
 * @param {string|Array} content
 * @returns {{ text: string, tools: Array<{name:string,input:string}>, hasToolResult: boolean, toolResultText: string }}
 */
function flattenContent(content) {
  if (!content) return { text: '', tools: [], hasToolResult: false, toolResultText: '' };

  // Plain string content
  if (typeof content === 'string') {
    return { text: content.trim().slice(0, TEXT_CAP), tools: [], hasToolResult: false, toolResultText: '' };
  }

  if (!Array.isArray(content)) {
    return { text: capStr(content, TEXT_CAP), tools: [], hasToolResult: false, toolResultText: '' };
  }

  const textParts = [];
  const tools = [];
  let hasToolResult = false;
  const resultParts = [];

  for (const block of content) {
    if (!block || typeof block !== 'object') continue;

    switch (block.type) {
      case 'text':
        if (block.text) textParts.push(block.text);
        break;

      case 'thinking':
        // Skip extended thinking blocks — they are internal monologue
        break;

      case 'tool_use':
        tools.push({
          name: block.name || '?',
          input: capStr(block.input, TOOL_INPUT_CAP),
        });
        break;

      case 'tool_result': {
        hasToolResult = true;
        // content can be a string or an array of text blocks
        const rc = block.content;
        if (typeof rc === 'string') {
          resultParts.push(rc.slice(0, 300));
        } else if (Array.isArray(rc)) {
          for (const rb of rc) {
            if (rb && rb.type === 'text' && rb.text) resultParts.push(rb.text.slice(0, 300));
          }
        }
        break;
      }

      default:
        // image, document, etc. — skip
        break;
    }
  }

  let text = textParts.join('\n').trim();
  if (text.length > TEXT_CAP) text = text.slice(0, TEXT_CAP) + '…';

  return {
    text,
    tools,
    hasToolResult,
    toolResultText: resultParts.join('\n').trim().slice(0, 600),
  };
}

/**
 * Scan PROJECTS_ROOT for <sessionId>.jsonl — checks direct children and one level of subdirectories
 * (covers sub-agent sessions stored in subfolders).
 * @param {string} sessionId
 * @returns {string|null} absolute path or null
 */
function findFile(sessionId) {
  const target = sessionId + '.jsonl';
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(PROJECTS_ROOT);
  } catch (_) {
    return null;
  }

  for (const dirName of projectDirs) {
    const dirPath = path.join(PROJECTS_ROOT, dirName);
    let stat;
    try { stat = fs.statSync(dirPath); } catch (_) { continue; }
    if (!stat.isDirectory()) continue;

    // Direct child
    const direct = path.join(dirPath, target);
    if (fs.existsSync(direct)) return direct;

    // One level deeper (sub-agent sessions — stored in <projectDir>/<subfolderName>/<sessionId>.jsonl)
    let sub;
    try { sub = fs.readdirSync(dirPath); } catch (_) { continue; }
    for (const subName of sub) {
      const subPath = path.join(dirPath, subName);
      let subStat;
      try { subStat = fs.statSync(subPath); } catch (_) { continue; }
      if (!subStat.isDirectory()) continue;
      const nested = path.join(subPath, target);
      if (fs.existsSync(nested)) return nested;
    }
  }
  return null;
}

/**
 * Parse a single JSONL line into a structured message, or null to skip.
 * @param {string} line
 * @returns {object|null}
 */
function parseLine(line) {
  let obj;
  try { obj = JSON.parse(line); } catch (_) { return null; }
  if (!obj || typeof obj !== 'object') return null;

  const t = obj.type;

  // We only care about user / assistant / system messages
  if (t !== 'user' && t !== 'assistant' && t !== 'system') return null;

  // system entries from Claude Code (stop hook summaries, etc.) — condense to a brief note
  if (t === 'system') {
    const sub = obj.subtype || '';
    const note = sub ? `[system: ${sub}]` : '[system event]';
    return {
      role: 'system',
      ts: obj.timestamp || null,
      text: note,
      tools: [],
    };
  }

  // user / assistant — must have a message object
  const msg = obj.message;
  if (!msg || typeof msg !== 'object') return null;

  const role = msg.role === 'assistant' ? 'assistant' : 'user';
  const { text, tools, hasToolResult, toolResultText } = flattenContent(msg.content);

  // Pure tool-result lines with no user text and no tools — emit as compact system note
  if (role === 'user' && hasToolResult && !text && !tools.length) {
    if (!toolResultText) return null; // nothing useful to show
    return {
      role: 'system',
      ts: obj.timestamp || null,
      text: `[tool result] ${toolResultText.slice(0, 300)}`,
      tools: [],
    };
  }

  // Skip lines with nothing at all
  if (!text && !tools.length) return null;

  return {
    role,
    ts: obj.timestamp || null,
    text,
    tools,
  };
}

/**
 * Read and parse a session transcript.
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function read(sessionId) {
  // Validate
  if (!sessionId || typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
    return { error: 'invalid session id' };
  }

  const filePath = findFile(sessionId);
  if (!filePath) return { error: 'session not found' };

  // Determine cwd from the first line that has one
  let cwd = null;

  const messages = [];
  let parseError = null;

  await new Promise((resolve) => {
    let stream;
    try {
      stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    } catch (e) {
      parseError = e.message;
      resolve();
      return;
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const raw = JSON.parse(line);
        if (!cwd && raw && raw.cwd) cwd = raw.cwd;
      } catch (_) {}

      const msg = parseLine(line);
      if (msg) messages.push(msg);
    });

    rl.on('close', resolve);
    rl.on('error', (e) => { parseError = e.message; resolve(); });
    stream.on('error', (e) => { parseError = e.message; resolve(); });
  });

  if (parseError && messages.length === 0) {
    return { error: 'could not read session: ' + parseError };
  }

  // Cap to last MAX_MESSAGES
  const truncated = messages.length > MAX_MESSAGES;
  const slice = truncated ? messages.slice(messages.length - MAX_MESSAGES) : messages;

  const project = cwd ? path.basename(cwd) : null;

  return {
    ok: true,
    sessionId,
    cwd: cwd || null,
    project,
    messages: slice,
    count: slice.length,
    truncated,
  };
}

module.exports = { read };
