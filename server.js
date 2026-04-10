const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Polyfill fetch for older Node.js versions
const fetch = require('node-fetch');

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: NODE_ENV === 'production' ? false : "*", // Disable CORS in production for security
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Add payload size limit
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_MESSAGE = { role: "system", content: "You are a helpful college helpdesk assistant for educational institutions. Answer questions about admissions, fees, exams, courses, and campus services." };

// Store chat histories per session (using socket ID or a simple session ID)
const chatHistories = new Map(); // Use Map for better memory management
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_SESSIONS = 1000; // Maximum number of active sessions

/**
 * Get or create chat history for a session
 * @param {string} sessionId - The session identifier
 * @returns {Array} The chat history array for the session
 */
function getChatHistory(sessionId) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    throw new Error('Invalid session ID');
  }

  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, {
      messages: [SYSTEM_MESSAGE],
      lastActivity: Date.now(),
      created: Date.now()
    });
  }

  const session = chatHistories.get(sessionId);
  session.lastActivity = Date.now(); // Update last activity

  return session.messages;
}

/**
 * Cleanup old sessions to prevent memory leaks
 */
function cleanupOldSessions() {
  const now = Date.now();
  const toDelete = [];

  for (const [sessionId, session] of chatHistories.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      toDelete.push(sessionId);
    }
  }

  toDelete.forEach(sessionId => chatHistories.delete(sessionId));

  // If still too many sessions, remove oldest ones
  if (chatHistories.size > MAX_SESSIONS) {
    const sortedSessions = Array.from(chatHistories.entries())
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity);

    const sessionsToRemove = sortedSessions.slice(0, chatHistories.size - MAX_SESSIONS);
    sessionsToRemove.forEach(([sessionId]) => chatHistories.delete(sessionId));
  }

  console.log(`Cleaned up ${toDelete.length} old sessions. Active sessions: ${chatHistories.size}`);
}

// Run cleanup every hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

// Serve the main website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSessions: chatHistories.size,
    version: require('./package.json').version
  });
});

// AI Chat API
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const incomingMessages = req.body.messages;
    const sessionId = req.body.sessionId || 'default';

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ reply: "Invalid session ID." });
    }

    let chatHistory = getChatHistory(sessionId);

    if (incomingMessages && Array.isArray(incomingMessages)) {
      // If messages are provided, use them but ensure system message is included
      const hasSystemMessage = incomingMessages.some(msg => msg.role === 'system');
      chatHistory = hasSystemMessage ? incomingMessages : [SYSTEM_MESSAGE, ...incomingMessages];
      chatHistories.get(sessionId).messages = chatHistory;
    } else if (typeof userMessage === "string" && userMessage.trim()) {
      chatHistory.push({ role: "user", content: userMessage.trim() });
    } else {
      return res.status(400).json({ reply: "Invalid request payload. Please provide a valid message." });
    }

    console.log(`Processing chat for session ${sessionId}, history length: ${chatHistory.length}`);

    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: chatHistory,
        stream: false
      }),
      timeout: 30000 // 30 second timeout
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
    chatHistory.push({ role: "assistant", content: reply });

    res.json({ reply, sessionId });

  } catch (error) {
    console.error("Chat API Error:", error.message);
    res.status(500).json({ reply: "Sorry, I'm having trouble connecting to the AI service. Please try again later." });
  }
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat_message', async (message) => {
    if (!message || typeof message !== 'string' || !message.trim()) {
      socket.emit('bot_reply', 'Please send a valid message.');
      return;
    }

    // Rate limiting: max 10 messages per minute per user
    const now = Date.now();
    const session = chatHistories.get(socket.id);
    if (session) {
      const recentMessages = session.messages.filter(msg =>
        msg.role === 'user' && (now - (msg.timestamp || 0)) < 60000
      );
      if (recentMessages.length >= 10) {
        socket.emit('bot_reply', 'Too many messages. Please wait a moment before sending another message.');
        return;
      }
    }

    try {
      const sessionId = socket.id; // Use socket ID as session ID
      let chatHistory = getChatHistory(sessionId);

      const userMessage = { role: "user", content: message.trim(), timestamp: now };
      chatHistory.push(userMessage);

      console.log(`Socket chat for session ${sessionId}, history length: ${chatHistory.length}`);

      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: chatHistory,
          stream: false
        }),
        timeout: 30000
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
      const assistantMessage = { role: "assistant", content: reply, timestamp: Date.now() };
      chatHistory.push(assistantMessage);

      socket.emit('bot_reply', reply);
    } catch (error) {
      console.error("Socket Chat Error:", error.message);
      socket.emit('bot_reply', "Sorry, I'm having trouble responding right now. Please try again.");
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Note: We keep chat history for potential reconnection
    // Cleanup will happen automatically via cleanupOldSessions()
  });
});

server.listen(PORT, () => {
  console.log(`🚀 AI Help Desk Server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🤖 AI Model: ${OLLAMA_MODEL} at ${OLLAMA_HOST}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});