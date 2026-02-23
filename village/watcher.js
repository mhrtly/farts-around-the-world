/**
 * Village Watcher — reads Claude Code JSONL transcripts and serves agent state
 *
 * Scans ~/.claude/projects/ for sessions belonging to this project,
 * auto-detects persona names from user messages, and exposes a
 * /api/state endpoint that the village renderer polls.
 *
 * Run:  node village/watcher.js
 * API:  http://localhost:3002/api/state
 */

import { createServer } from 'http'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 3002
const POLL_INTERVAL = 2000 // ms between transcript re-reads

// Claude Code stores transcripts here
const CLAUDE_DIR = join(
  process.env.HOME,
  '.claude',
  'projects',
  '-Users-markhartley-Documents-Farts-Around-The-World-App'
)

// The 6 personas we're looking for
const PERSONAS = ['spudnik', 'quipu', 'inti', 'chaska', 'wari', 'chasqui']

// Map tool names to activity states
const TOOL_TO_ACTIVITY = {
  Read: 'reading',
  Grep: 'reading',
  Glob: 'reading',
  Write: 'writing',
  Edit: 'writing',
  NotebookEdit: 'writing',
  Bash: 'digging',       // "digging in the field"
  Task: 'delegating',
  TodoWrite: 'planning',
  WebFetch: 'scouting',
  WebSearch: 'scouting',
  EnterPlanMode: 'planning',
  ExitPlanMode: 'planning',
  AskUserQuestion: 'talking',
}

/**
 * Parse a JSONL file and extract:
 * - persona (from first user message containing a name)
 * - last activity (from most recent tool use)
 * - whether session is still active (recent timestamp)
 */
function parseTranscript(filepath) {
  try {
    const raw = readFileSync(filepath, 'utf-8')
    const lines = raw.trim().split('\n').filter(Boolean)

    let persona = null
    let lastActivity = 'idle'
    let lastActivityName = ''
    let lastTimestamp = 0
    let messageCount = 0
    let toolUseCount = 0

    for (const line of lines) {
      let obj
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }

      // Track timestamps
      if (obj.timestamp) {
        const ts = new Date(obj.timestamp).getTime()
        if (ts > lastTimestamp) lastTimestamp = ts
      }

      // Detect persona from user messages
      if (obj.type === 'user' && obj.message?.content && !persona) {
        const content = typeof obj.message.content === 'string'
          ? obj.message.content.toLowerCase()
          : JSON.stringify(obj.message.content).toLowerCase()

        for (const name of PERSONAS) {
          // Look for "you are X" or "you're X" patterns
          if (
            content.includes(`you are ${name}`) ||
            content.includes(`you are **${name}**`) ||
            content.includes(`you're ${name}`) ||
            content.includes(`i am ${name}`) ||
            content.includes(`as ${name}`)
          ) {
            persona = name
            break
          }
        }
      }

      // Count messages
      if (obj.type === 'user' || obj.type === 'assistant') {
        messageCount++
      }

      // Track latest tool use
      if (obj.type === 'assistant' && obj.message?.content) {
        const content = obj.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              toolUseCount++
              const toolName = block.name || ''
              // Strip MCP prefixes
              const shortName = toolName.replace(/^mcp__\w+__/, '')
              lastActivity = TOOL_TO_ACTIVITY[shortName] || 'working'
              lastActivityName = shortName
            }
          }
        }
      }
    }

    // Determine if session is active (had activity in last 5 minutes)
    const now = Date.now()
    const isActive = (now - lastTimestamp) < 5 * 60 * 1000
    const isRecent = (now - lastTimestamp) < 30 * 60 * 1000

    // If not active, override to idle or sleeping
    if (!isActive) {
      lastActivity = isRecent ? 'idle' : 'sleeping'
    }

    return {
      persona,
      lastActivity,
      lastActivityName,
      lastTimestamp,
      isActive,
      isRecent,
      messageCount,
      toolUseCount,
    }
  } catch (err) {
    return null
  }
}

/**
 * Scan all sessions for this project and build state
 */
function buildState() {
  const agents = {}

  // Initialize all personas as offline
  for (const name of PERSONAS) {
    agents[name] = {
      name,
      status: 'offline',
      activity: 'sleeping',
      activityDetail: '',
      sessionId: null,
      messageCount: 0,
      toolUseCount: 0,
      lastSeen: null,
    }
  }

  if (!existsSync(CLAUDE_DIR)) {
    return { agents, timestamp: Date.now(), projectDir: CLAUDE_DIR }
  }

  // Find all session JSONL files (top-level, not subagents)
  const files = readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.jsonl'))

  for (const file of files) {
    const filepath = join(CLAUDE_DIR, file)
    const sessionId = file.replace('.jsonl', '')
    const parsed = parseTranscript(filepath)

    if (!parsed) continue

    // If we detected a persona, update its state
    if (parsed.persona && agents[parsed.persona]) {
      const existing = agents[parsed.persona]
      // Use the most recent session for this persona
      if (!existing.lastSeen || parsed.lastTimestamp > new Date(existing.lastSeen).getTime()) {
        agents[parsed.persona] = {
          name: parsed.persona,
          status: parsed.isActive ? 'active' : parsed.isRecent ? 'idle' : 'offline',
          activity: parsed.lastActivity,
          activityDetail: parsed.lastActivityName,
          sessionId,
          messageCount: parsed.messageCount,
          toolUseCount: parsed.toolUseCount,
          lastSeen: new Date(parsed.lastTimestamp).toISOString(),
        }
      }
    }
  }

  // Special: Quipu is THIS session — always mark active
  // (Auto-detect: the current session is always Quipu since it's the coordinator)
  const currentSessionId = getCurrentSessionId()
  if (currentSessionId) {
    agents.quipu.status = 'active'
    agents.quipu.activity = 'planning'
    agents.quipu.activityDetail = 'coordinating'
    agents.quipu.sessionId = currentSessionId
  }

  // Spudnik is always "in the cloud" (Claude Web — we can't detect it)
  agents.spudnik.status = 'cloud'
  agents.spudnik.activity = 'meditating'
  agents.spudnik.activityDetail = 'contemplating the cosmic potato'

  return {
    agents,
    timestamp: Date.now(),
    activeCount: Object.values(agents).filter(a => a.status === 'active').length,
  }
}

function getCurrentSessionId() {
  // Try to find the most recently modified session file
  if (!existsSync(CLAUDE_DIR)) return null
  const files = readdirSync(CLAUDE_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      mtime: statSync(join(CLAUDE_DIR, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)

  return files[0]?.name.replace('.jsonl', '') || null
}

// Simple HTTP server (no deps needed)
const server = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  if (req.url === '/api/state') {
    res.setHeader('Content-Type', 'application/json')
    const state = buildState()
    res.end(JSON.stringify(state, null, 2))
    return
  }

  // Serve static files from village/
  let filePath = req.url === '/' ? '/index.html' : req.url
  const fullPath = join(__dirname, filePath)

  try {
    if (!existsSync(fullPath)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const content = readFileSync(fullPath)
    const ext = filePath.split('.').pop()
    const mimeTypes = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      json: 'application/json',
    }
    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain')
    res.end(content)
  } catch {
    res.writeHead(500)
    res.end('Server error')
  }
})

server.listen(PORT, () => {
  console.log(``)
  console.log(`  ╔══════════════════════════════════════════╗`)
  console.log(`  ║   THE ANDEAN VILLAGE — Agent Watcher     ║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Village:  http://localhost:${PORT}         ║`)
  console.log(`  ║   API:      http://localhost:${PORT}/api/state║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Watching Claude Code transcripts...    ║`)
  console.log(`  ╚══════════════════════════════════════════╝`)
  console.log(``)
})
