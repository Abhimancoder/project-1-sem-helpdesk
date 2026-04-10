const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
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

// ---------------- SYSTEM PROMPT ----------------
const SYSTEM_MESSAGE = {
  role: 'system',
  content:
    'You are a helpful college helpdesk assistant. Answer questions about admissions, fees, exams, courses, and campus services.',
};

// ---------------- SESSION STORAGE ----------------
const chatHistories = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;

function getChatHistory(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session ID');
  }

  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, {
      messages: [SYSTEM_MESSAGE],
      lastActivity: Date.now(),
    });
  }

  const session = chatHistories.get(sessionId);
  session.lastActivity = Date.now();

  return session.messages;
}

// ---------------- CLEANUP ----------------
setInterval(() => {
  const now = Date.now();

  for (const [id, session] of chatHistories.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      chatHistories.delete(id);
    }
  }

  if (chatHistories.size > MAX_SESSIONS) {
    const sorted = [...chatHistories.entries()].sort(
      (a, b) => a[1].lastActivity - b[1].lastActivity
    );

    sorted.slice(0, chatHistories.size - MAX_SESSIONS).forEach(([id]) => {
      chatHistories.delete(id);
    });
  }
}, 60 * 60 * 1000);

// ---------------- ROUTES ----------------
app.get('/', (req, res) => {
  res.send('EduDesk AI Server Running');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeSessions: chatHistories.size,
    model: OLLAMA_MODEL,
    host: OLLAMA_HOST,
  });
});

// ---------------- CHAT API ----------------
app.post('/chat', async (req, res) => {
  try {
    const { message, messages, sessionId = 'default' } = req.body;

    if (!sessionId) {
      return res.status(400).json({ reply: 'Invalid session ID' });
    }

    let chatHistory = getChatHistory(sessionId);

    if (Array.isArray(messages)) {
      chatHistory = [SYSTEM_MESSAGE, ...messages];
      chatHistories.get(sessionId).messages = chatHistory;
    } else if (message && typeof message === 'string') {
      chatHistory.push({ role: 'user', content: message });
    } else {
      return res.status(400).json({ reply: 'Invalid message' });
    }

    // ---------------- SAFE OLLAMA CALL ----------------
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: chatHistory,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Ollama error:', errText);
      throw new Error('Ollama request failed');
    }

    const data = await response.json();

    const reply = data?.message?.content || 'No response from AI';

    chatHistory.push({ role: 'assistant', content: reply });

    res.json({ reply, sessionId });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({
      reply: 'AI service error. Please try again later.',
    });
  }
});

// ---------------- SOCKET.IO ----------------
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat_message', async (msg) => {
    if (!msg || typeof msg !== 'string') return;

    try {
      const history = getChatHistory(socket.id);
      history.push({ role: 'user', content: msg });

      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: history,
          stream: false,
        }),
      });

      const data = await response.json();
      const reply = data?.message?.content || 'No response';

      history.push({ role: 'assistant', content: reply });

      socket.emit('bot_reply', reply);
    } catch (err) {
      console.error('Socket error:', err.message);
      socket.emit('bot_reply', 'AI error. Try again.');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ---------------- START SERVER ----------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤖 Model: ${OLLAMA_MODEL}`);
  console.log(`📡 Ollama: ${OLLAMA_HOST}`);
});