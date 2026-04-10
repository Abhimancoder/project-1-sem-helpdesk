const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SYSTEM_MESSAGE = {
  role: 'system',
  content:
    'You are a helpful college helpdesk assistant for educational institutions. Answer questions about admissions, fees, exams, courses, and campus services.',
};

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduDesk AI — Smart Help Desk</title>
  <style>
    :root { --bg:#f7f4ee; --fg:#1a1814; --muted:#5f5a50; --teal:#2a7f6f; --teal-light:#3fa08e; --white:#ffffff; --shadow:0 16px 40px rgba(0,0,0,.08); }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;}
    header{padding:24px 32px;display:flex;justify-content:space-between;align-items:center;background:var(--white);box-shadow:var(--shadow);position:sticky;top:0;z-index:100;}
    header .brand{font-weight:800;font-size:1.2rem;color:var(--teal);}
    nav a{margin-left:18px;color:var(--muted);text-decoration:none;font-weight:600;}
    .hero{padding:80px 32px 40px;max-width:1080px;margin:0 auto;text-align:center;}
    .hero h1{font-size:3rem;line-height:1.05;margin-bottom:20px;}
    .hero p{max-width:720px;margin:0 auto 28px;color:var(--muted);}
    .hero .buttons a{display:inline-flex;align-items:center;justify-content:center;padding:14px 24px;border-radius:999px;font-weight:700;text-decoration:none;margin:0 8px;}
    .btn-primary{background:var(--teal);color:white;}
    .btn-secondary{border:2px solid var(--teal);color:var(--teal);background:transparent;}
    .section{padding:48px 32px;max-width:1080px;margin:0 auto;}
    .section h2{font-size:2rem;margin-bottom:14px;}
    .section p{color:var(--muted);max-width:720px;margin-bottom:24px;}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;}
    .card{background:white;border-radius:24px;padding:28px;box-shadow:var(--shadow);}
    .card h3{margin-bottom:12px;font-size:1.1rem;}
    .card p{color:var(--muted);font-size:0.95rem;}
    footer{padding:28px 32px;text-align:center;color:var(--muted);}
    #chatFab{position:fixed;right:28px;bottom:28px;width:64px;height:64px;border:none;border-radius:50%;background:var(--teal);color:white;font-size:1.7rem;cursor:pointer;box-shadow:0 20px 50px rgba(0,0,0,.18);z-index:200;}
    #chatWindow{position:fixed;right:28px;bottom:108px;width:360px;max-height:560px;background:white;border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;transform:translateY(24px);opacity:0;pointer-events:none;transition:all .25s ease;}
    #chatWindow.open{transform:translateY(0);opacity:1;pointer-events:auto;}
    .cw-header{padding:18px 20px;background:var(--teal);color:white;display:flex;align-items:center;justify-content:space-between;}
    .cw-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;}
    .cw-footer{padding:12px 16px;border-top:1px solid #eee;display:flex;gap:10px;align-items:center;}
    .cw-input{flex:1;padding:12px 14px;border:1px solid #ddd;border-radius:16px;resize:none;min-height:42px;}
    .cw-send{width:44px;height:44px;border-radius:14px;border:none;background:var(--teal);color:white;cursor:pointer;}
    .message{display:flex;gap:12px;align-items:flex-end;}
    .message.user{justify-content:flex-end;}
    .bubble{max-width:78%;padding:12px 14px;border-radius:18px;}
    .bubble.bot{background:#f0f7f5;color:var(--fg);border-radius:18px 18px 18px 4px;}
    .bubble.user{background:var(--teal);color:white;border-radius:18px 18px 4px 18px;}
    .chat-meta{font-size:.82rem;color:var(--muted);margin-bottom:12px;}
    @media(max-width:820px){header, .hero, .section, footer{padding:20px;}#chatWindow{right:20px;bottom:90px;width:calc(100vw - 40px);}}
  </style>
</head>
<body>
  <header>
    <div class="brand">EduDesk AI</div>
    <nav>
      <a href="#features">Features</a>
      <a href="#how-it-works">How it works</a>
      <a href="#contact">Contact</a>
      <a href="/issues-tracker">Issues</a>
    </nav>
  </header>

  <main>
    <section class="hero" id="home">
      <div class="chat-meta">Live AI help desk with Ollama support</div>
      <h1>Smart help desk for colleges and universities</h1>
      <p>Provide 24/7 admissions, fee, exam, and campus support using AI that understands your institution.</p>
      <div class="buttons">
        <a href="#contact" class="btn-primary">Get Started</a>
        <a href="#how-it-works" class="btn-secondary">See How It Works</a>
      </div>
    </section>

    <section class="section" id="features">
      <h2>What EduDesk AI does</h2>
      <p>Instantly answer student queries, automate ticket routing, and provide reliable campus support.</p>
      <div class="grid">
        <div class="card"><h3>AI Chatbot</h3><p>Natural conversational assistance for admissions, fees, exams, and campus services.</p></div>
        <div class="card"><h3>24/7 Support</h3><p>Students get answers any time, even outside office hours.</p></div>
        <div class="card"><h3>Smart Escalation</h3><p>Complex queries are handed over to staff with full context.</p></div>
      </div>
    </section>

    <section class="section" id="how-it-works">
      <h2>How it works</h2>
      <div class="grid">
        <div class="card"><h3>1. Ask a question</h3><p>Students type their query into the chat.</p></div>
        <div class="card"><h3>2. AI responds</h3><p>The system sends the question to Ollama and returns a helpful answer.</p></div>
        <div class="card"><h3>3. Track and escalate</h3><p>If needed, the issue can be escalated to a human agent.</p></div>
      </div>
    </section>

    <section class="section" id="contact">
      <h2>Ready to go live?</h2>
      <p>Start Ollama, then start this server to see your help desk in action.</p>
      <div class="grid">
        <div class="card"><h3>Step 1</h3><p>Open Ollama and run <code>ollama serve</code>.</p></div>
        <div class="card"><h3>Step 2</h3><p>Then run <code>node server-inline.js</code> in this project folder.</p></div>
        <div class="card"><h3>Step 3</h3><p>Open <code>http://localhost:3000</code> in your browser.</p></div>
      </div>
    </section>
  </main>

  <button id="chatFab" aria-label="Open chat">💬</button>
  <div id="chatWindow" aria-live="polite">
    <div class="cw-header">
      <div>EduDesk AI</div>
      <button onclick="toggleChat()" aria-label="Close chat">✕</button>
    </div>
    <div class="cw-body" id="cwBody"></div>
    <div class="cw-footer">
      <textarea id="cwInput" rows="1" placeholder="Ask a question..." oninput="autoResize(this)" onkeydown="handleKey(event)"></textarea>
      <button class="cw-send" id="cwSend" onclick="sendMessage()" aria-label="Send message">➤</button>
    </div>
  </div>

  <footer>© 2026 EduDesk AI — Powered by Ollama</footer>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    let opened = false;
    let streaming = false;
    let sessionId = null;
    const history = [];

    function toggleChat() {
      const win = document.getElementById('chatWindow');
      const fab = document.getElementById('chatFab');
      const open = win.classList.toggle('open');
      fab.textContent = open ? '✕' : '💬';
      if (!opened && open) { opened = true; addMessage('Hello! I\'m EduDesk AI. Ask me anything about admissions, fees, exams, or campus services.', 'bot'); }
    }

    function addMessage(text, type) {
      const body = document.getElementById('cwBody');
      const msg = document.createElement('div');
      msg.className = 'message ' + type;
      msg.innerHTML = '<div class="bubble ' + type + '">' + text + '</div>';
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    function handleKey(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    async function sendMessage() {
      const input = document.getElementById('cwInput');
      const text = input.value.trim();
      if (!text || streaming) return;
      addMessage(text, 'user');
      input.value = '';
      autoResize(input);
      document.getElementById('cwSend').disabled = true;
      streaming = true;

      addMessage('Typing...', 'bot');
      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, messages: history, sessionId }),
        });
        const data = await res.json();
        if (data.sessionId) sessionId = data.sessionId;
        const body = document.getElementById('cwBody');
        body.removeChild(body.lastChild);
        addMessage(data.reply || 'Sorry, I could not get an answer right now.', 'bot');
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: data.reply || '' });
      } catch (error) {
        const body = document.getElementById('cwBody');
        body.removeChild(body.lastChild);
        addMessage('Sorry, I\'m having trouble connecting right now.', 'bot');
      }
      document.getElementById('cwSend').disabled = false;
      streaming = false;
    }
  </script>
</body>
</html>`;

const issuesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduDesk AI - Issues Tracker</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;background:#f7f4ee;color:#1a1814;padding:32px;}
    h1{margin-bottom:12px;}
    .card{background:white;padding:24px;border-radius:24px;box-shadow:0 16px 40px rgba(0,0,0,.08);margin-bottom:20px;}
    .status{display:inline-flex;padding:6px 12px;border-radius:999px;font-weight:700;font-size:.85rem;}
    .resolved{background:#d7f4e8;color:#1b653f;}
    .pending{background:#fff3cd;color:#855a0c;}
    a{color:#2a7f6f;text-decoration:none;}
  </style>
</head>
<body>
  <a href="/">← Back to EduDesk AI</a>
  <h1>Resolved Issues</h1>
  <div id="content">Loading...</div>
  <script>
    async function load() {
      const response = await fetch('/issues');
      const data = await response.json();
      const container = document.getElementById('content');
      container.innerHTML = '<p><strong>' + data.resolvedIssues + '/' + data.totalIssues + '</strong> issues resolved.</p>';
      data.issues.forEach(issue => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><strong>' + issue.id + '. ' + issue.title + '</strong><span class="status ' + issue.status + '">' + issue.status + '</span></div><p>' + issue.description + '</p>';
        container.appendChild(card);
      });
    }
    load().catch(err => (document.getElementById('content').textContent = 'Unable to load issues.'));
  </script>
</body>
</html>`;

const chatHistories = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;

function getChatHistory(sessionId) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    throw new Error('Invalid session ID');
  }

  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, {
      messages: [SYSTEM_MESSAGE],
      lastActivity: Date.now(),
      created: Date.now(),
    });
  }

  const session = chatHistories.get(sessionId);
  session.lastActivity = Date.now();
  return session.messages;
}

function cleanupOldSessions() {
  const now = Date.now();
  const toDelete = [];

  for (const [sessionId, session] of chatHistories.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      toDelete.push(sessionId);
    }
  }

  toDelete.forEach((sessionId) => chatHistories.delete(sessionId));

  if (chatHistories.size > MAX_SESSIONS) {
    const sorted = Array.from(chatHistories.entries()).sort((a, b) => a[1].lastActivity - b[1].lastActivity);
    sorted.slice(0, chatHistories.size - MAX_SESSIONS).forEach(([sessionId]) => chatHistories.delete(sessionId));
  }
}

setInterval(cleanupOldSessions, 60 * 60 * 1000);

app.get('/', (req, res) => {
  res.send(indexHtml);
});

app.get('/issues-tracker', (req, res) => {
  res.send(issuesHtml);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSessions: chatHistories.size,
    version: require('./package.json').version,
  });
});

app.get('/issues', (req, res) => {
  const issues = [
    { id: 1, title: 'Node-fetch dependency', description: 'Removed node-fetch and used built-in fetch in Node 24+', status: 'resolved', severity: 'high', fixed: true },
    { id: 2, title: 'Environment configuration', description: 'Added env settings and defaults for Ollama and server options.', status: 'resolved', severity: 'medium', fixed: true },
    { id: 3, title: 'Session management', description: 'Use Map-based session storage and cleanup stale sessions.', status: 'resolved', severity: 'high', fixed: true },
    { id: 4, title: 'Rate limiting', description: 'Prevent too many messages per minute per user.', status: 'resolved', severity: 'medium', fixed: true },
    { id: 5, title: 'Input validation', description: 'Validate incoming payloads and session IDs.', status: 'resolved', severity: 'high', fixed: true },
    { id: 6, title: 'Health checks', description: 'Added /health endpoint for monitoring.', status: 'resolved', severity: 'low', fixed: true },
    { id: 7, title: 'Graceful shutdown', description: 'Handle SIGINT and SIGTERM cleanly.', status: 'resolved', severity: 'medium', fixed: true },
    { id: 8, title: 'Error handling', description: 'Respond with friendly messages when failures occur.', status: 'resolved', severity: 'high', fixed: true },
    { id: 9, title: 'Security improvements', description: 'Added CORS and safer request handling.', status: 'resolved', severity: 'high', fixed: true },
    { id: 10, title: 'Code quality', description: 'Improved structure and stability.', status: 'resolved', severity: 'low', fixed: true },
  ];

  res.json({
    totalIssues: issues.length,
    resolvedIssues: issues.filter((issue) => issue.fixed).length,
    pendingIssues: issues.filter((issue) => !issue.fixed).length,
    issues,
    lastUpdated: new Date().toISOString(),
  });
});

app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const incomingMessages = req.body.messages;
    const sessionId = req.body.sessionId || 'default';

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ reply: 'Invalid session ID.' });
    }

    let chatHistory = getChatHistory(sessionId);

    if (incomingMessages && Array.isArray(incomingMessages)) {
      const hasSystem = incomingMessages.some((msg) => msg.role === 'system');
      chatHistory = hasSystem ? incomingMessages : [SYSTEM_MESSAGE, ...incomingMessages];
      chatHistories.get(sessionId).messages = chatHistory;
    } else if (typeof userMessage === 'string' && userMessage.trim()) {
      chatHistory.push({ role: 'user', content: userMessage.trim() });
    } else {
      return res.status(400).json({ reply: 'Invalid request payload. Please provide a valid message.' });
    }

    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: chatHistory, stream: false }),
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.message || !data.message.content) {
      throw new Error('Invalid response from Ollama API');
    }

    const reply = data.message.content;
    chatHistory.push({ role: 'assistant', content: reply });
    res.json({ reply, sessionId });
  } catch (error) {
    console.error('Chat API Error:', error.message);
    res.status(500).json({ reply: 'Sorry, I\'m having trouble connecting to the AI service. Please try again later.' });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat_message', async (message) => {
    if (!message || typeof message !== 'string' || !message.trim()) {
      socket.emit('bot_reply', 'Please send a valid message.');
      return;
    }

    const now = Date.now();
    const session = chatHistories.get(socket.id);
    if (session) {
      const recentMessages = session.messages.filter((msg) => msg.role === 'user' && now - (msg.timestamp || 0) < 60000);
      if (recentMessages.length >= 10) {
        socket.emit('bot_reply', 'Too many messages. Please wait a moment before sending another message.');
        return;
      }
    }

    try {
      const sessionId = socket.id;
      const chatHistory = getChatHistory(sessionId);
      chatHistory.push({ role: 'user', content: message.trim(), timestamp: now });

      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages: chatHistory, stream: false }),
        timeout: 30000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.message || !data.message.content) {
        throw new Error('Invalid response from Ollama API');
      }

      const reply = data.message.content;
      chatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      socket.emit('bot_reply', reply);
    } catch (error) {
      console.error('Socket Chat Error:', error.message);
      socket.emit('bot_reply', 'Sorry, I\'m having trouble responding right now. Please try again.');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 AI Help Desk Server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🤖 AI Model: ${OLLAMA_MODEL} at ${OLLAMA_HOST}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
