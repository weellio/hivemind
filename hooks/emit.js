#!/usr/bin/env node
// Agent Ops Center — hook emitter.
//
// Reads a Claude Code hook payload from stdin and forwards it verbatim to the
// bridge's /api/hook endpoint. Used as a `command` hook so it works on every
// Claude Code version and platform (no dependency on `type: "http"` hooks).
//
// It NEVER blocks Claude: if the bridge isn't running or is slow, it exits 0
// quietly so hooks stay invisible until the dashboard is up.

const http = require('http');

let data = '';
process.stdin.on('data', (c) => { data += c; if (data.length > 1e6) process.stdin.destroy(); });
process.stdin.on('end', () => {
  const port = process.env.AOC_PORT || 3131;
  const payload = data || '{}';
  const req = http.request(
    {
      host: 'localhost', port, path: '/api/hook', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 1500,
    },
    (res) => { res.resume(); res.on('end', () => process.exit(0)); }
  );
  req.on('error', () => process.exit(0));      // bridge down → no-op, don't block Claude
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.end(payload);
});
process.stdin.on('error', () => process.exit(0));
