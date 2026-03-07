/**
 * Village Watcher v2 — reads Claude Code JSONL transcripts and serves agent state
 *
 * Scans ~/.claude/projects/ for sessions belonging to this project,
 * auto-detects persona names from user messages, extracts recent activity
 * logs with file paths and descriptions, and exposes a /api/state endpoint
 * that the village renderer polls.
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
const POLL_INTERVAL = 2000

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
  Bash: 'digging',
  Task: 'delegating',
  TodoWrite: 'planning',
  WebFetch: 'scouting',
  WebSearch: 'scouting',
  EnterPlanMode: 'planning',
  ExitPlanMode: 'planning',
  AskUserQuestion: 'talking',
}

/**
 * Extract a short description from a tool_use block
 */
function describeToolUse(block) {
  const name = (block.name || '').replace(/^mcp__\w+__/, '')
  const input = block.input || {}

  switch (name) {
    case 'Read':
      return input.file_path
        ? `Reading ${shortenPath(input.file_path)}`
        : 'Reading file'
    case 'Write':
      return input.file_path
        ? `Writing ${shortenPath(input.file_path)}`
        : 'Writing file'
    case 'Edit':
      return input.file_path
        ? `Editing ${shortenPath(input.file_path)}`
        : 'Editing file'
    case 'Grep':
      return input.pattern
        ? `Searching for "${truncate(input.pattern, 30)}"`
        : 'Searching code'
    case 'Glob':
      return input.pattern
        ? `Finding ${truncate(input.pattern, 30)}`
        : 'Finding files'
    case 'Bash':
      return input.command
        ? `$ ${truncate(input.command, 40)}`
        : 'Running command'
    case 'Task':
      return input.description
        ? `Delegating: ${truncate(input.description, 30)}`
        : 'Spawning sub-agent'
    case 'TodoWrite':
      return 'Updating task list'
    case 'WebFetch':
      return input.url
        ? `Fetching ${truncate(input.url, 35)}`
        : 'Fetching web page'
    case 'WebSearch':
      return input.query
        ? `Searching: "${truncate(input.query, 30)}"`
        : 'Web search'
    case 'AskUserQuestion':
      return 'Asking Mark a question'
    case 'EnterPlanMode':
      return 'Entering plan mode'
    case 'ExitPlanMode':
      return 'Plan ready for review'
    default:
      return name || 'Working...'
  }
}

function shortenPath(p) {
  if (!p) return '?'
  // Strip the project root prefix
  const stripped = p.replace(/^.*Farts_Around_The_World_App\//, '')
  // If still long, show last 2 segments
  const parts = stripped.split('/')
  if (parts.length > 3) return '.../' + parts.slice(-2).join('/')
  return stripped
}

function truncate(s, max) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '...' : s
}

/**
 * Parse a JSONL file and extract persona, activity, and recent actions
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
    const recentActions = [] // collect all, trim later
    let currentMsgTimestamp = 0

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
        currentMsgTimestamp = ts
      }

      // Detect persona from user messages
      if (obj.type === 'user' && obj.message?.content && !persona) {
        const content = typeof obj.message.content === 'string'
          ? obj.message.content.toLowerCase()
          : JSON.stringify(obj.message.content).toLowerCase()

        for (const name of PERSONAS) {
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

      // Track tool uses with descriptions
      if (obj.type === 'assistant' && obj.message?.content) {
        const content = obj.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              toolUseCount++
              const toolName = (block.name || '').replace(/^mcp__\w+__/, '')
              lastActivity = TOOL_TO_ACTIVITY[toolName] || 'working'
              lastActivityName = toolName
              recentActions.push({
                tool: toolName,
                activity: TOOL_TO_ACTIVITY[toolName] || 'working',
                description: describeToolUse(block),
                timestamp: currentMsgTimestamp,
              })
            }
          }
        }
      }
    }

    // Determine if session is active (had activity in last 5 minutes)
    const now = Date.now()
    const isActive = (now - lastTimestamp) < 5 * 60 * 1000
    const isRecent = (now - lastTimestamp) < 30 * 60 * 1000

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
      recentActions: recentActions.slice(-15), // last 15 actions
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
      recentActions: [],
    }
  }

  if (!existsSync(CLAUDE_DIR)) {
    return { agents, timestamp: Date.now(), activityLog: [] }
  }

  const files = readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.jsonl'))

  for (const file of files) {
    const filepath = join(CLAUDE_DIR, file)
    const sessionId = file.replace('.jsonl', '')
    const parsed = parseTranscript(filepath)

    if (!parsed) continue

    if (parsed.persona && agents[parsed.persona]) {
      const existing = agents[parsed.persona]
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
          recentActions: parsed.recentActions,
        }
      }
    }
  }

  // Quipu = this session, always active
  const currentSessionId = getCurrentSessionId()
  if (currentSessionId) {
    agents.quipu.status = 'active'
    agents.quipu.activity = 'planning'
    agents.quipu.activityDetail = 'coordinating'
    agents.quipu.sessionId = currentSessionId
  }

  // Spudnik = Claude Web, always "in the cloud"
  agents.spudnik.status = 'cloud'
  agents.spudnik.activity = 'meditating'
  agents.spudnik.activityDetail = 'contemplating the cosmic potato'

  // Build combined activity log (last 30 across all agents)
  const activityLog = []
  for (const [name, agent] of Object.entries(agents)) {
    for (const action of (agent.recentActions || [])) {
      activityLog.push({ ...action, agent: name })
    }
  }
  activityLog.sort((a, b) => b.timestamp - a.timestamp)

  return {
    agents,
    timestamp: Date.now(),
    activeCount: Object.values(agents).filter(a => a.status === 'active').length,
    activityLog: activityLog.slice(0, 30),
  }
}

function getCurrentSessionId() {
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

// HTTP server
const server = createServer((req, res) => {
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
  console.log(`  ║   THE ANDEAN VILLAGE v2 — Agent Watcher  ║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Village:  http://localhost:${PORT}         ║`)
  console.log(`  ║   API:      http://localhost:${PORT}/api/state║`)
  console.log(`  ║                                          ║`)
  console.log(`  ║   Now with activity logs!                ║`)
  console.log(`  ╚══════════════════════════════════════════╝`)
  console.log(``)
})
