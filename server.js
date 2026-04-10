const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Note: fetch is available globally in Node.js 18+
// If you see linting errors, ensure your Node.js version supports fetch
// or add: const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_MESSAGE = { role: "system", content: "You are a helpful college helpdesk assistant for educational institutions. Answer questions about admissions, fees, exams, courses, and campus services." };

// Store chat histories per session (using socket ID or a simple session ID)
const chatHistories = new Map(); // Use Map for better memory management

/**
 * Get or create chat history for a session
 * @param {string} sessionId - The session identifier
 * @returns {Array} The chat history array for the session
 */
function getChatHistory(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, [SYSTEM_MESSAGE]);
  }
  return chatHistories.get(sessionId);
}

// Cleanup function to prevent memory leaks (optional)
function cleanupOldSessions() {
  // In a production app, you might want to clean up old sessions
  // For now, we'll let them accumulate as the app runs
}

// Serve the main website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// AI Chat API
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const incomingMessages = req.body.messages;
    const sessionId = req.body.sessionId || 'default'; // Use sessionId from request

    let chatHistory = getChatHistory(sessionId);

    if (incomingMessages && Array.isArray(incomingMessages)) {
      // If messages are provided, use them but ensure system message is included
      const hasSystemMessage = incomingMessages.some(msg => msg.role === 'system');
      chatHistory = hasSystemMessage ? incomingMessages : [SYSTEM_MESSAGE, ...incomingMessages];
      chatHistories.set(sessionId, chatHistory);
    } else if (typeof userMessage === "string" && userMessage.trim()) {
      chatHistory.push({ role: "user", content: userMessage.trim() });
    } else {
      return res.status(400).json({ reply: "Invalid request payload. Please provide a valid message." });
    }

    console.log(`Processing chat for session ${sessionId}, history length: ${chatHistory.length}`);

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        messages: chatHistory,
        stream: false
      })
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

    try {
      const sessionId = socket.id; // Use socket ID as session ID
      let chatHistory = getChatHistory(sessionId);

      chatHistory.push({ role: "user", content: message.trim() });

      console.log(`Socket chat for session ${sessionId}, history length: ${chatHistory.length}`);

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2',
          messages: chatHistory,
          stream: false
        })
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

      socket.emit('bot_reply', reply);
    } catch (error) {
      console.error("Socket Chat Error:", error.message);
      socket.emit('bot_reply', "Sorry, I'm having trouble responding right now. Please try again.");
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Optionally clean up chat history after some time
    // setTimeout(() => delete chatHistories[socket.id], 3600000); // Clean up after 1 hour
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AI Help Desk Server running on port ${PORT}`);
});