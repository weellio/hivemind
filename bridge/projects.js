// Hivemind — Claude project registry + component manager.
//
// Knows every Claude project (from configured root folders + auto-imported from
// running sessions + the global ~/.claude), lists each one's components
// (skills / agents / commands / hooks / mcp), and copies a component between
// projects. Config persists to bridge/aoc-projects.json.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CFG = path.join(__dirname, 'aoc-projects.json');
let cfg = (() => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (_) { return {}; } })();
cfg.roots = cfg.roots || [];
cfg.known = cfg.known || [];
function persist() { try { fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2)); } catch (_) {} }

// Case-insensitive identity key for a path (Windows paths differ only by drive-letter case).
function keyOf(p) { try { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; } catch (_) { return String(p || ''); } }

function getConfig() { return cfg; }
function addRoot(p) { p = String(p || '').trim(); if (p && !cfg.roots.includes(p)) { cfg.roots.push(p); persist(); } return cfg; }
function removeRoot(p) { cfg.roots = cfg.roots.filter((r) => r !== p); persist(); return cfg; }
function noteKnown(cwd) {
  if (!cwd) return;
  const k = keyOf(cwd);
  if (!cfg.known.some((x) => keyOf(x) === k)) { cfg.known.push(cwd); persist(); }
}

function listDir(p) { try { return fs.readdirSync(p, { withFileTypes: true }); } catch (_) { return []; } }
function hasClaude(dir) {
  try { return fs.existsSync(path.join(dir, '.claude')) || fs.existsSync(path.join(dir, '.claude-plugin')); } catch (_) { return false; }
}

// Read components from a given .claude directory.
function componentsOf(claudeDir, projectDir) {
  const out = { skills: [], agents: [], commands: [], hooks: [], mcp: [] };
  for (const d of listDir(path.join(claudeDir, 'skills'))) if (d.isDirectory()) out.skills.push(d.name);
  for (const f of listDir(path.join(claudeDir, 'commands'))) if (f.isFile() && f.name.endsWith('.md')) out.commands.push(f.name.replace(/\.md$/, ''));
  for (const f of listDir(path.join(claudeDir, 'agents'))) if (f.isFile() && f.name.endsWith('.md')) out.agents.push(f.name.replace(/\.md$/, ''));
  try { const s = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8')); if (s.hooks) out.hooks = Object.keys(s.hooks); } catch (_) {}
  try { const m = JSON.parse(fs.readFileSync(path.join(projectDir || claudeDir, '.mcp.json'), 'utf8')); if (m.mcpServers) out.mcp = Object.keys(m.mcpServers); } catch (_) {}
  return out;
}

function project(dir) {
  const p = path.resolve(dir);
  return { path: p, name: path.basename(p) || p, sources: [], running: false, ...componentsOf(path.join(p, '.claude'), p) };
}

function discover() {
  const seen = new Map(); // resolved path -> project
  const add = (dir, source, requireClaude) => {
    let rp; try { rp = path.resolve(dir); } catch (_) { return; }
    const k = keyOf(rp);
    if (seen.has(k)) { if (source) seen.get(k).sources.push(source); return; }
    if (requireClaude && !hasClaude(rp)) return;
    const pr = project(rp);
    if (source) pr.sources.push(source);
    seen.set(k, pr);
  };

  // Global ~/.claude as a first-class entry.
  const home = os.homedir();
  const globalClaude = path.join(home, '.claude');
  if (fs.existsSync(globalClaude)) {
    // path = home so copyComponent(home) targets <home>/.claude (= ~/.claude)
    seen.set('__global__', { path: home, name: 'Global (user)', sources: ['global'], running: false, ...componentsOf(globalClaude, home) });
  }

  // Configured roots: the root itself, and its immediate children that look like projects.
  for (const root of cfg.roots) {
    add(root, 'root', true);
    for (const d of listDir(root)) if (d.isDirectory()) add(path.join(root, d.name), 'root', true);
  }
  // Auto-imported session cwds (kept even without local .claude — they're live projects).
  for (const k of cfg.known) add(k, 'session', false);

  return Array.from(seen.values());
}

function copyHook(fromDir, toDir, event, overwrite) {
  try {
    const src = JSON.parse(fs.readFileSync(path.join(fromDir, '.claude', 'settings.json'), 'utf8'));
    if (!src.hooks || !src.hooks[event]) return { error: 'source hook not found' };
    const tp = path.join(toDir, '.claude', 'settings.json');
    let tgt = {}; try { tgt = JSON.parse(fs.readFileSync(tp, 'utf8')); } catch (_) {}
    tgt.hooks = tgt.hooks || {};
    if (tgt.hooks[event] && !overwrite) return { exists: true };
    tgt.hooks[event] = src.hooks[event];
    fs.mkdirSync(path.dirname(tp), { recursive: true });
    fs.writeFileSync(tp, JSON.stringify(tgt, null, 2) + '\n');
    return { ok: true, copied: event };
  } catch (e) { return { error: e.message }; }
}

function copyMcp(fromDir, toDir, name, overwrite) {
  try {
    const src = JSON.parse(fs.readFileSync(path.join(fromDir, '.mcp.json'), 'utf8'));
    if (!src.mcpServers || !src.mcpServers[name]) return { error: 'source MCP server not found' };
    const tp = path.join(toDir, '.mcp.json');
    let tgt = {}; try { tgt = JSON.parse(fs.readFileSync(tp, 'utf8')); } catch (_) {}
    tgt.mcpServers = tgt.mcpServers || {};
    if (tgt.mcpServers[name] && !overwrite) return { exists: true };
    tgt.mcpServers[name] = src.mcpServers[name];
    fs.writeFileSync(tp, JSON.stringify(tgt, null, 2) + '\n');
    return { ok: true, copied: name };
  } catch (e) { return { error: e.message }; }
}

function copyComponent(type, name, fromDir, toDir, overwrite) {
  if (!type || !name || !fromDir || !toDir) return { error: 'type, name, fromCwd, toCwd required' };
  if (/[\\/]/.test(name) || name.includes('..')) return { error: 'invalid name' };
  if (type === 'hook') return copyHook(fromDir, toDir, name, overwrite);
  if (type === 'mcp') return copyMcp(fromDir, toDir, name, overwrite);
  const rel = type === 'skill' ? ['skills', name]
    : type === 'agent' ? ['agents', name + '.md']
    : type === 'command' ? ['commands', name + '.md'] : null;
  if (!rel) return { error: 'unknown type' };
  const src = path.join(fromDir, '.claude', ...rel);
  const dst = path.join(toDir, '.claude', ...rel);
  if (!fs.existsSync(src)) return { error: 'source not found' };
  if (fs.existsSync(dst) && !overwrite) return { exists: true };
  try { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.cpSync(src, dst, { recursive: true }); return { ok: true, copied: name }; }
  catch (e) { return { error: e.message }; }
}

module.exports = { getConfig, addRoot, removeRoot, noteKnown, discover, project, copyComponent, keyOf };
