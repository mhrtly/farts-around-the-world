import { createServer } from 'http';
import { readFile, appendFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3003;
const FEEDBACK_FILE = join(__dirname, 'FEEDBACK.md');
const CLAUDE_BIN = '/Users/markhartley/.local/bin/claude';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

// ── SSE state ──
let currentJob = null;
let sseClients = [];

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(data); return true; } catch { return false; }
  });
}

function startClaudeJob(message) {
  if (currentJob && !currentJob.done) {
    return false; // one at a time
  }

  const prompt = [
    'You are editing the "Cmd+Up" web app, a standalone prioritization tool.',
    `Working directory: ${__dirname}`,
    '',
    'Files you may edit:',
    '- index.html (HTML structure)',
    '- style.css (broadsheet/letterpress aesthetic — cream background, Georgia serif, minimalist)',
    '- app.js (question engine state machine + feedback panel logic)',
    '',
    'Do NOT edit serve.js or any files outside this directory.',
    'Do NOT add any npm dependencies — this is vanilla HTML/CSS/JS.',
    '',
    'The user is using the app right now and submitted this change request:',
    '',
    `"${message}"`,
    '',
    'Make the requested change. Be surgical — only change what is needed.',
  ].join('\n');

  currentJob = { log: [], done: false, proc: null };
  broadcast({ type: 'start' });

  const proc = spawn(CLAUDE_BIN, [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--allowedTools', 'Read,Edit,Write,Glob,Grep',
    '--model', 'sonnet',
  ], {
    cwd: __dirname,
    env: (() => {
      const env = {
        ...process.env,
        PATH: `/Users/markhartley/.local/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
      };
      // Remove nesting guard so claude can spawn as a fresh session
      delete env.CLAUDECODE;
      return env;
    })(),
  });

  currentJob.proc = proc;

  let buffer = '';

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line);
        const update = simplifyEvent(evt);
        if (update) {
          currentJob.log.push(update);
          broadcast(update);
        }
      } catch {
        // raw text fallback
        if (line.trim()) {
          const u = { type: 'text', content: line.trim() };
          currentJob.log.push(u);
          broadcast(u);
        }
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error('[CLAUDE STDERR]', text);
    }
  });

  proc.on('close', (code) => {
    // flush remaining buffer
    if (buffer.trim()) {
      try {
        const evt = JSON.parse(buffer.trim());
        const update = simplifyEvent(evt);
        if (update) { currentJob.log.push(update); broadcast(update); }
      } catch {
        const u = { type: 'text', content: buffer.trim() };
        currentJob.log.push(u);
        broadcast(u);
      }
    }
    currentJob.done = true;
    broadcast({ type: 'done', code });
    console.log(`[CLAUDE] Process exited with code ${code}`);
  });

  proc.on('error', (err) => {
    currentJob.done = true;
    const u = { type: 'error', content: `Failed to start claude: ${err.message}` };
    currentJob.log.push(u);
    broadcast(u);
    broadcast({ type: 'done', code: -1 });
  });

  return true;
}

function simplifyEvent(evt) {
  // Handle various stream-json shapes from claude CLI
  // Text content
  if (evt.type === 'assistant' && evt.message) {
    const msg = evt.message;
    if (msg.type === 'text' && msg.text) {
      return { type: 'text', content: msg.text };
    }
    if (msg.type === 'tool_use' && msg.name) {
      return { type: 'tool', name: msg.name };
    }
  }

  // Content block deltas (streaming text)
  if (evt.type === 'content_block_delta') {
    const delta = evt.delta;
    if (delta && delta.type === 'text_delta' && delta.text) {
      return { type: 'text', content: delta.text };
    }
  }

  // Content block start (tool use)
  if (evt.type === 'content_block_start') {
    const block = evt.content_block;
    if (block && block.type === 'tool_use' && block.name) {
      return { type: 'tool', name: block.name };
    }
  }

  // Result message
  if (evt.type === 'result') {
    const text = evt.result || evt.content || '';
    if (text) return { type: 'text', content: typeof text === 'string' ? text : JSON.stringify(text) };
  }

  return null;
}

// ── Server ──

createServer(async (req, res) => {
  // CORS for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── SSE endpoint ──
  if (req.method === 'GET' && req.url === '/feedback/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('\n'); // flush headers

    // Send history of current job
    if (currentJob) {
      for (const e of currentJob.log) {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      }
      if (currentJob.done) {
        res.write(`data: ${JSON.stringify({ type: 'done', code: 0 })}\n\n`);
      }
    }

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // ── Feedback POST ──
  if (req.method === 'POST' && req.url === '/feedback') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { message } = JSON.parse(body);
      if (!message || !message.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Empty message' }));
        return;
      }
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const entry = `\n---\n**${ts}**\n\n${message.trim()}\n`;
      await appendFile(FEEDBACK_FILE, entry);
      console.log(`[FEEDBACK] ${ts}: ${message.trim().slice(0, 80)}`);

      // Start claude job
      const started = startClaudeJob(message.trim());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, building: started }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request' }));
    }
    return;
  }

  // ── Static files ──
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const ext = extname(filePath);
  const mime = MIME[ext] || 'text/plain';

  try {
    const data = await readFile(join(__dirname, filePath));
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Cmd+Up dev server: http://localhost:${PORT}`);
});
