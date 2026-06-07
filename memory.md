# Project Memory — Agent Ops Center

> This file is updated by Claude Code as the project evolves.
> It tracks decisions, discoveries, and current state so context is never lost between sessions.

---

## Project Origin

Conceived in a Claude.ai conversation. The user wanted a visual alternative to watching text scroll in Claude Code — instead, each agent appears as an animated avatar in a Hollywood Squares / Zoom-style grid, physically acting out what it's doing.

Initial prototype showed pixel art characters with:
- `?` bubble for thinking
- Keyboard typing + code on screen for coding
- Phone held up with text bubbles for spawning sub-agents
- Document held out with scanning eyes for reading
- Arms raised + sparks for errors
- Z's floating for idle

User feedback: characters needed to be bigger/more readable. Grid/avatar selection UI was desired.

---

## Current Status

**Phase**: Project initialization — files created, not yet in Claude Code.

**Completed**:
- [x] Concept defined and prototyped in Claude.ai chat
- [x] CLAUDE.md written with full architecture spec
- [x] memory.md created

**In Progress**:
- [ ] Nothing yet — waiting for Claude Code session to begin

**Up Next** (Phase 1 — Dashboard UI):
- [ ] `dashboard/index.html` — base shell, WebSocket client stub
- [ ] `dashboard/src/grid.js` — layout engine with 5 presets
- [ ] `dashboard/src/avatar.js` — pixel art renderer (bigger sprites, ~64×80px logical)
- [ ] `dashboard/src/themes.js` — Hollywood Squares, War Room, Broadcast, Squad, Solo, Mosaic
- [ ] Avatar selector UI — pixel art / GIF / abstract toggle per agent
- [ ] GIF support with CSS state overlays

**Phase 2** (Bridge server):
- [ ] `bridge/server.js` — Node.js WebSocket server
- [ ] `bridge/parser.js` — stdout event pattern matching
- [ ] `bridge/agent-registry.js` — agent lifecycle tracking

**Phase 3** (Claude Code wiring):
- [ ] Test with real `claude` CLI output
- [ ] Tune regex patterns against actual event stream
- [ ] Handle edge cases: crashed agents, timeouts, nested sub-agents

---

## Key Decisions

### Avatar rendering approach
**Decision**: Procedural Canvas drawing (not spritesheet PNG).
**Reason**: Easier to iterate on poses, no asset pipeline needed, easy to parameterize shirt color / hair / accessories per-agent.
**Revisit if**: We want truly polished pixel art — then spritesheet makes sense.

### Framework choice
**Decision**: Vanilla JS, no framework.
**Reason**: Dashboard needs to be fast, portable, zero build step. It's a utility tool, not a product.

### WebSocket vs. SSE
**Decision**: WebSocket (bidirectional).
**Reason**: May want dashboard → bridge control messages in future (pause agent, kill agent, etc.).

### Grid layout
**Decision**: CSS Grid with named presets, swappable via class.
**Reason**: Clean, responsive, easy to animate transitions between layouts.

---

## Discoveries & Notes

*(Claude Code will append findings here during development)*

### Claude Code output format
- TBD: confirm if `--output-format stream-json` is available in installed version
- Fallback: parse human-readable stdout with regex patterns defined in CLAUDE.md

### Avatar sprite sizing
- User wants bigger/more readable characters
- Target: 64px wide × 80px tall logical pixels (2× DPR = 128×160 canvas pixels)
- At this size, facial expressions and hand positions are clearly legible

### GIF overlay strategy
- CSS approach: wrap GIF in `<div>` with `::after` pseudo-element for state badge
- Color tint: `filter: sepia(1) saturate(2) hue-rotate(Xdeg)` per state color
- Badge: absolute-positioned pill in corner (state name + color dot)

---

## Environment

- **OS**: Windows 10 (PowerShell shell — use Windows paths/commands, not Unix)
- **Claude Code**: Installed (terminal + VS Code extension)
- **Node.js**: Assumed available (confirm version at session start)
- **Browser target**: Chrome/Edge latest (no IE/legacy support needed)

---

## Session Log

| Date | Session Summary |
|------|----------------|
| 2026-06-07 | Project conceived, CLAUDE.md + memory.md created via Claude.ai chat |

---

## User Preferences

- Wants visual personality — avatars should feel alive, not clinical
- Prefers Hollywood Squares aesthetic for the grid
- Wants avatar customization per-agent (pixel art, GIF, abstract)
- Wants layout themes selectable from presets
- Non-blocking: dashboard is a companion window, not replacing the terminal
- Values readability: bigger sprites so state is obvious at a glance
