require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const OpenAI = require("openai");
const path = require("path");

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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "demo-key"
});

let chatHistory = [
  { role: "system", content: "You are a helpful college helpdesk assistant for educational institutions. Answer questions about admissions, fees, exams, courses, and campus services." }
];

// Serve the main website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// AI Chat API
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const incomingMessages = req.body.messages;

    if (incomingMessages && Array.isArray(incomingMessages)) {
      chatHistory = [...incomingMessages];
    } else if (typeof userMessage === "string") {
      chatHistory.push({ role: "user", content: userMessage });
    } else {
      return res.status(400).json({ reply: "Invalid request payload" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatHistory,
    });

    const reply = response.choices[0].message.content;
    chatHistory.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({ reply: "Sorry, I'm having trouble connecting to the AI service. Please try again later." });
  }
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat_message', async (message) => {
    try {
      chatHistory.push({ role: "user", content: message });

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatHistory,
      });

      const reply = response.choices[0].message.content;
      chatHistory.push({ role: "assistant", content: reply });

      socket.emit('bot_reply', reply);
    } catch (error) {
      console.error("Socket Chat Error:", error);
      socket.emit('bot_reply', "Sorry, I'm having trouble responding right now.");
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AI Help Desk Server running on port ${PORT}`);
});